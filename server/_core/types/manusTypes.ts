export interface ExchangeTokenRequest {
  clientId: string;
  grantType: string;
  code: string;
  redirectUri: string;
}

export interface ExchangeTokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface GetUserInfoResponse {
  openId: string;
  name?: string;
  email?: string;
  platform?: string | null;
  loginMethod?: string | null;
  platforms?: string[];
}

export interface GetUserInfoWithJwtRequest {
  jwtToken: string;
  projectId: string;
}

export interface GetUserInfoWithJwtResponse extends GetUserInfoResponse {
  taskUid?: string;
}
