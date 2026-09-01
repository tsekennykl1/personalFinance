// src/auth/amplifyConfig.js
// Only configures Amplify when auth is enabled.
// Imported as a side-effect in main.jsx.

import { Amplify } from "aws-amplify";

const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === "true";

if (AUTH_ENABLED) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: "ap-east-1_SLKp7l2NA",
        userPoolClientId: "7e2t3dtfc2p2si7o1fu1jlpffm",
        loginWith: {
          oauth: {
            domain: "ap-east-1slkp7l2na.auth.ap-east-1.amazoncognito.com",
            scopes: ["openid", "email", "profile"],
            redirectSignIn: [
              "https://staging.d37gylpwhasobk.amplifyapp.com",
            ],
            redirectSignOut: [
              "https://staging.d37gylpwhasobk.amplifyapp.com",
            ],
            responseType: "code",
          },
        },
      },
    },
  });
}