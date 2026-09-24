import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = {
  title: "Sign in — Datlify",
  description:
    "Sign in or create your Datlify account. Continue with Google, GitHub or Apple, or use your email — one account for the whole AI workspace.",
};

export default function AuthRoutePage() {
  return <AuthPage />;
}