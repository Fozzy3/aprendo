/**
 * Where a school writes to buy or ask. Set per deployment (`VITE_CONTACT_EMAIL`);
 * without it the landing offers no contact rather than a made-up address.
 */
export const CONTACT_EMAIL: string | null = import.meta.env.VITE_CONTACT_EMAIL || null
