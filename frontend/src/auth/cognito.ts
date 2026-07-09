import type { AuthProviderProps } from 'react-oidc-context';

const cognitoRegion = import.meta.env.VITE_COGNITO_REGION || 'ap-southeast-1';
const cognitoClientId =
  import.meta.env.VITE_COGNITO_CLIENT_ID || '6vnaf36cgvsddiiddug6mqr0rg';
const cognitoUserPoolId =
  import.meta.env.VITE_COGNITO_USER_POOL_ID || 'ap-southeast-1_7WU2LnxwE';

const appOrigin = window.location.origin;

export const cognitoAuthConfig: AuthProviderProps = {
  authority: `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`,
  client_id: cognitoClientId,
  post_logout_redirect_uri: `${appOrigin}/`,
  redirect_uri: `${appOrigin}/`,
  response_type: 'code',
  scope: 'openid email profile',
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

export const cognitoStoragePrefix = `oidc.user:${cognitoAuthConfig.authority}:${cognitoClientId}`;
