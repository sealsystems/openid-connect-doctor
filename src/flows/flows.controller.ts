//SDPX-License-Identifier: MIT
//SDPX-FileCopyrightText: 2022 Philip Rebbe <rebbe.philip@fau.de>
//SDPX-FileCopyrightText: 2022 Raghunandan Arava <raghunandan.arava@fau.de>
//SDPX-FileCopyrightText: 2022 Michael Kupfer <michael.kupfer@fau.de>

import {
  Controller,
  Get,
  Post,
  Body,
  Render,
  Query,
  Res,
  Inject,
} from '@nestjs/common';
import { ClientCredentialFlowInputDto } from './Dto/clientCredentialFlowInput.dto';
import { PasswordGrantFlowInputDto } from './Dto/passwordGrantFlowInput.dto';
import { FlowsService } from './flows.service';
import { AuthInputDto } from './Dto/authInput.dto';
import { Response } from 'express';
import { TokenService } from '../token/token.service';

@Controller('flows')
export class FlowsController {
  dicoveryContent: string;

  @Inject(TokenService)
  private readonly tokenService: TokenService;

  constructor(private readonly flowsService: FlowsService) {}

  @Get('index')
  @Render('flows')
  async index(@Query('issuer_s') issuer_s: string) {
    const result = await this.flowsService.getAllowedGrantTypes(issuer_s);

    return {
      issuer_s: issuer_s,
      allowClientCredentials: result.allowClientCredentials,
      allowPasswordGrant: result.allowPasswordGrant,
      allowAuthorizationCode: result.allowAuthorizationCode,
    };
  }

  @Get('cc')
  @Render('cc')
  async get(@Query('issuer_s') issuer_s: string) {
    return {
      issuer_s: issuer_s,
    };
  }

  @Get('auth')
  @Render('authorization-flow')
  async getAuth(@Query('issuer_s') issuer_s: string) {
    return {
      issuer_s: issuer_s,
    };
  }

  @Get('callback')
  async redirectPage() {
    return 200;
  }

  @Post('authorize')
  @Render('decode')
  async authCallback(@Body() authInputDto: AuthInputDto) {
    const schemas_header = await this.tokenService.getSchemas(
      'header',
      undefined,
    );
    const schemas_payload = await this.tokenService.getSchemas(
      'payload',
      undefined,
    );
    const result = await this.flowsService
      .authorizationFlowRawToken(
        authInputDto.issuer,
        authInputDto.clientId,
        authInputDto.clientSecret,
        authInputDto.url,
        authInputDto.redirectUri,
      )
      .then((tokenString) => {
        return {
          message:
            'Go to Advanced Settings or click submit to decode your token',
          show_results: false,
          result: {
            header: '',
            payload: '',
          },
          previous: {
            issuer: authInputDto.issuer,
            token: tokenString,
            schemas_header: schemas_header,
            schemas_payload: schemas_payload,
            header_match_error: false,
            payload_match_error: false,
            validated_header_against_schema: false,
            validated_payload_against_schema: false,
          },
          key_algorithms: this.tokenService.getKeyAlgorithms(),
        };
      })
      .catch((error) => {
        return {
          message: `Something went wrong: ${error}`,
          show_results: false,
          result: {
            header: '',
            payload: '',
          },
          previous: {
            issuer: authInputDto.issuer,
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
      });
    return result;
  }

  @Post('cc')
  @Render('decode')
  async post(
    @Body() clientCredentialFlowInputDto: ClientCredentialFlowInputDto,
  ) {
    const schemas_header = await this.tokenService.getSchemas(
      'header',
      undefined,
    );
    const schemas_payload = await this.tokenService.getSchemas(
      'payload',
      undefined,
    );
    const result = await this.flowsService
      .clientCredentialsRawToken(
        clientCredentialFlowInputDto.issuerUrl,
        clientCredentialFlowInputDto.clientId,
        clientCredentialFlowInputDto.clientSecret,
        clientCredentialFlowInputDto.audience,
      )
      .then((tokenString) => {
        return {
          message:
            'Go to Advanced Settings or click submit to decode your token',
          show_results: false,
          result: {
            header: '',
            payload: '',
          },
          previous: {
            issuer: clientCredentialFlowInputDto.issuerUrl,
            token: tokenString,
            schemas_header: schemas_header,
            schemas_payload: schemas_payload,
            header_match_error: false,
            payload_match_error: false,
            validated_header_against_schema: false,
            validated_payload_against_schema: false,
          },
          key_algorithms: this.tokenService.getKeyAlgorithms(),
        };
      })
      .catch((error) => {
        return {
          message: `Something went wrong: ${error}`,
          show_results: false,
          result: {
            header: '',
            payload: '',
          },
          previous: {
            issuer: clientCredentialFlowInputDto.issuerUrl,
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
      });

    return result;
  }
  @Get('pg')
  @Render('password_grant')
  async getPg(@Query('issuer_s') issuer_s: string) {
    return {
      issuer_s: issuer_s,
    };
  }

  @Post('pg')
  @Render('decode')
  async postPg(@Body() passwordGrantFlowInputDto: PasswordGrantFlowInputDto) {
    const schemas_header = await this.tokenService.getSchemas(
      'header',
      undefined,
    );
    const schemas_payload = await this.tokenService.getSchemas(
      'payload',
      undefined,
    );
    const result = await this.flowsService
      .passwordGrantRawToken(
        passwordGrantFlowInputDto.issuerUrl,
        passwordGrantFlowInputDto.clientId,
        passwordGrantFlowInputDto.clientSecret,
        passwordGrantFlowInputDto.username,
        passwordGrantFlowInputDto.password,
      )
      .then((tokenString) => {
        return {
          message:
            'Go to Advanced Settings or click submit to decode your token',
          show_results: false,
          result: {
            header: '',
            payload: '',
          },
          previous: {
            issuer: passwordGrantFlowInputDto.issuerUrl,
            token: tokenString,
            schemas_header: schemas_header,
            schemas_payload: schemas_payload,
            header_match_error: false,
            payload_match_error: false,
            validated_header_against_schema: false,
            validated_payload_against_schema: false,
          },
          key_algorithms: this.tokenService.getKeyAlgorithms(),
        };
      })
      .catch((error) => {
        return {
          message: `Something went wrong: ${error}`,
          show_results: false,
          result: {
            header: '',
            payload: '',
          },
          previous: {
            issuer: passwordGrantFlowInputDto.issuerUrl,
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
      });
    return result;
  }
}
