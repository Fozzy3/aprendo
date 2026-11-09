import { useState } from 'react'
import { authClient } from './auth-client.ts'

/** Salir, from every shell: a full reload so nothing of the account stays cached. */
export function useSignOut() {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const signOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      window.location.assign('/')
    }
  }
  return { signOut, isSigningOut }
}
