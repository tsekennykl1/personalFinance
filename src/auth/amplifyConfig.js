// src/auth/amplifyConfig.js
// Only configures Amplify when auth is enabled.
// Imported as a side-effect in main.jsx.

import { Amplify } from "aws-amplify";

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === "true";

if (AUTH_ENABLED) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: "ap-east-1_In4wDJ1Oz",
        userPoolClientId: "2mkh4lvgmrrnmkkvqa1dg72tf0",
        loginWith: {
          oauth: {
            domain: "finance-api-auth.auth.ap-east-1.amazoncognito.com",
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [
              "http://localhost:5176",
              "https://staging.d37gylpwhasobk.amplifyapp.com",
            ],
            redirectSignOut: [
              "http://localhost:5176",
              "https://staging.d37gylpwhasobk.amplifyapp.com",
            ],
            responseType: "code",
          },
        },
      },
    },
  });
}