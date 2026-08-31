import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

export default function LoginPage() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div>
          <h1>Welcome {user?.signInDetails?.loginId}</h1>
          <button onClick={signOut}>Sign out</button>
        </div>
      )}
    </Authenticator>
  );
}
