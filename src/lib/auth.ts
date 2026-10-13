import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  User 
} from 'firebase/auth';
import { app } from './firebase';

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error('Sign-in error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new Error('Account not found. Please register first.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error("Email/Password Sign-In is not enabled on Firebase yet! Please open the Firebase Console, go to 'Authentication' -> 'Sign-in method', and enable 'Email/Password' to register or sign in.");
    }
    throw error;
  }
};

export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error('Sign-up error:', error);
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already in use.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password should be at least 6 characters.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error("Email/Password Sign-In is not enabled on Firebase yet! Please open the Firebase Console, go to 'Authentication' -> 'Sign-in method', and enable 'Email/Password' to register or sign in.");
    }
    throw error;
  }
};

export const googleSignIn = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in window was closed before completion.');
    }
    throw error;
  }
};

export const logout = async () => {
  await auth.signOut();
};
