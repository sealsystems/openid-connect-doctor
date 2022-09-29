//SDPX-License-Identifier: MIT
//SDPX-FileCopyrightText: 2022 Philip Rebbe <rebbe.philip@fau.de>
//SDPX-FileCopyrightText: 2022 Raghunandan Arava <raghunandan.arava@fau.de>
//SDPX-FileCopyrightText: 2022 Michael Kupfer <michael.kupfer@fau.de>

import {
  Controller,
  Get,
  Render,
  Query,
  HttpException,
  HttpStatus,
  Res,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TokenService } from './token.service';
import { UtilsService } from '../utils/utils.service';
import { TokenDto } from './token.dto';
import { TokenFilterDto } from './tokenfilter.dto';
import { TokenResultDto } from './tokenResult.dto';
import { GrantBody } from 'openid-client';
import { join } from 'path';
import { Express, Response } from 'express';
import { createReadStream, promises as fs } from 'fs';
import { ExtendedProtocolService } from '../extended-protocol/extended-protocol.service';
import { TokenResultPage } from './tokenResultPage.dto';

@Controller('token')
export default class TokenController {
  @Inject(ExtendedProtocolService)
  private readonly protocolService: ExtendedProtocolService;

  constructor(
    private readonly tokenService: TokenService,
    private readonly utilsService: UtilsService,
  ) {}

  @Get('decode')
  @Render('decode')
  async get(@Query('schema') schema_s: string) {
    const schemas_header = await this.tokenService.getSchemas(
      'header',
      undefined,
    );
    const schemas_payload = await this.tokenService.getSchemas(
      'payload',
      undefined,
    );
    return {
      message: 'Please enter the wanted information!',
      show_results: false,
      result: {
        header: '',
        payload: '',
      },
      previous: {
        issuer: null,
        token: null,
        schemas_header: schemas_header,
        schemas_payload: schemas_payload,
        header_match_error: false,
        payload_match_error: false,
        validated_header_against_schema: false,
        validated_payload_against_schema: false,
      },
      key_algorithms: this.tokenService.getKeyAlgorithms(),
    };
  }

  @Post('decode')
  @Render('decode')
  async decode(@Body() tokenDto: TokenDto): Promise<TokenResultPage> {
    const schemas_header = await this.tokenService.getSchemas(
      'header',
      tokenDto.schema_header,
    );
    const schemas_payload = await this.tokenService.getSchemas(
      'payload',
      tokenDto.schema_payload,
    );

    const previous = {
      issuer: tokenDto.issuer,
      token: tokenDto.token,
      schemas_header: schemas_header,
      schemas_payload: schemas_payload,
      header_match_error: false,
      payload_match_error: false,
      match_error: false,
      validated_header_against_schema: false,
      validated_payload_against_schema: false,
    };

    this.protocolService.extendedLog('Start decoding token');

    const result = await this.tokenService
      .decodeToken(tokenDto.token)
      .then(async (result) => {
        const validationResult = await this.tokenService
          .validateTokenSignature(
            tokenDto.issuer,
            tokenDto.token,
            tokenDto.getKeysFromProvider,
            tokenDto.keyMaterialAlgorithm,
            tokenDto.keyMaterialFilepath,
          )
          .then(async (validationResult) => {
            await this.utilsService.writeOutput(
              result[0] + '\n' + result[1] + '\n' + validationResult[1],
            );
            return new TokenResultDto({
              success: validationResult[0],
              message: validationResult[1],
              header: result[0],
              payload: result[1],
            });
          })
          .catch((err) => {
            return new TokenResultDto({
              success: false,
              message: err.message,
              header: result[0],
              payload: result[1],
            });
          });

        return validationResult;
      })
      .catch((err) => {
        return new TokenResultDto({
          success: false,
          message: err.message,
        });
      });

    if (result.success) {
      this.protocolService.extendedLogSuccess('Token decoding succeeded');
    } else {
      this.protocolService.extendedLogError('Token decoding failed');
      return {
        show_results: true,
        message: result.message,

        result: {
          payload: result.payload,
          header: result.header,
        },
        previous: previous,
        key_algorithms: this.tokenService.getKeyAlgorithms(),
      };
    }

    const res = {
      show_results: result.payload !== undefined && result.header !== undefined,
      message: result.message,

      result: {
        header: result.header,
        payload: result.payload,
      },
      previous: previous,
      key_algorithms: this.tokenService.getKeyAlgorithms(),
    };

    if (result.success && tokenDto.schema_header !== '') {
      // color the header according to schema if decoding succeeded
      const schema_body = require(join('..', '..', 'schema', 'token', 'header', tokenDto.schema_header));
      const [success, colored_header] =
        await this.tokenService.coloredFilteredValidation(
          JSON.parse(result.header),
          schema_body,
        );
      let message = res.message;
      let header_match_error = false;
      if (success === 0) {
        this.protocolService.extendedLogError('Schema did not match');
        message = 'Decoding was successful, but header schema did not match';
        header_match_error = true;
      } else {
        this.protocolService.extendedLogSuccess('Decoded token matched schema');
      }
      res.show_results = result.success;

      res.result.header = colored_header;
      res.previous.header_match_error = header_match_error;
      res.previous.match_error = res.previous.match_error || header_match_error;
      res.previous.validated_header_against_schema = true;
      res.message = message;
    }

    if (result.success && tokenDto.schema_payload !== '') {
      // color the payload according to schema if decoding succeeded
      const schema_body = require(join('..', '..', 'schema', 'token', 'payload', tokenDto.schema_payload));
      const [success, colored_payload] =
        await this.tokenService.coloredFilteredValidation(
          JSON.parse(result.payload),
          schema_body,
        );
      let message = res.message;
      let payload_match_error = false;
      if (success === 0) {
        this.protocolService.extendedLogError('Schema did not match');
        message = 'Decoding was successful, but payload schema did not match';
        payload_match_error = true;
      } else {
        this.protocolService.extendedLogSuccess('Decoded token matched schema');
      }
      res.show_results = result.success;

      res.result.payload = colored_payload;
      res.previous.payload_match_error = payload_match_error;
      res.previous.match_error = res.previous.match_error || payload_match_error;
      res.previous.validated_payload_against_schema = true;
      res.message = message;
    }
    return res;
  }

  @Get('gettoken')
  async requestToken(
    @Query('issuer')
    issuer_s: string,
    @Res()
    res: Response,
  ): Promise<any> {
    const result = await this.tokenService.requestToken(issuer_s);
    res.json(result.data).send();
  }

  @Post('gettoken')
  async requestTokenWithClientInformation(
    @Query('issuer')
    issuer_s: string,
    @Body()
    grantBody: GrantBody,
    @Res()
    res: Response,
  ): Promise<any> {
    const issuer = await this.tokenService.getIssuer(issuer_s).catch(() => {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: 'invalid issuer',
        },
        HttpStatus.BAD_REQUEST,
      );
    });
    const result = await this.tokenService.getToken(
      String(issuer.token_endpoint),
      grantBody,
    );
    res.json(result.data).send();
  }

  @Post('/schema/upload')
  @UseInterceptors(FileInterceptor('upload'))
  async uploadSchema(@UploadedFile() file: Express.Multer.File, @Res() res) {
    if (file == null) {
      res.status(302).redirect('/api/token/decode');
      return;
    }
    await fs.writeFile(
      join(process.cwd(), 'schema/token', file.originalname),
      file.buffer,
    );
    res.status(302).redirect('/api/token/decode');
  }

  @Get('/schema/download')
  downloadSchema(@Query('schema') schema_s: string, @Res() res: Response) {
    if (schema_s === '') {
      res.status(302).redirect('/api/token/decode');
      return;
    }
    const file = createReadStream(
      join(process.cwd(), 'schema/token', schema_s),
    );
    file.pipe(res);
  }

  @Get('/schema/delete')
  async deleteSchema(@Query('schema') schema_s: string, @Res() res: Response) {
    if (schema_s === '') {
      res.status(302).redirect('/api/token/decode');
      return;
    }
    await fs.unlink(join(process.cwd(), 'schema/token', schema_s));
    res.status(302).redirect('/api/token/decode');
  }

  @Post('filter')
  async filter(@Body() tokenfilterDto: TokenFilterDto) {
    return this.tokenService.filterToken(
      tokenfilterDto.headerString,
      tokenfilterDto.payloadString,
      tokenfilterDto.filters,
    );
  }
}
