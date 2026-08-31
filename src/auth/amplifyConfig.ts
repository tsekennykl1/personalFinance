import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-east-1_XXXXXXXX',       // from SAM output
      userPoolClientId: 'your-client-id',       // from SAM output
      loginWith: {
        oauth: {
          domain: 'finance-api-auth.auth.ap-east-1.amazoncognito.com',
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: ['http://localhost:5173', 'https://staging.d37gylpwhasobk.amplifyapp.com'],
          redirectSignOut: ['http://localhost:5173', 'https://staging.d37gylpwhasobk.amplifyapp.com'],
          responseType: 'code',
        },
      },
    },
  },
});
