import { verify } from "otplib";

export function verifyAuthenticatorCode(secret: string, token: string, lastStep: number) {
  return verify({
    secret,
    token,
    epochTolerance: 30,
    // -1 means no code has been used; otplib accepts only nonnegative steps.
    ...(lastStep >= 0 ? { afterTimeStep: lastStep } : {}),
  });
}
