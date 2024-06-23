import NextAuth from "next-auth"
import "next-auth/jwt"

// import Apple from "next-auth/providers/apple"
// import Auth0 from "next-auth/providers/auth0"
// import AzureB2C from "next-auth/providers/azure-ad-b2c"
// import BankIDNorway from "next-auth/providers/bankid-no"
// import BoxyHQSAML from "next-auth/providers/boxyhq-saml"
// import Cognito from "next-auth/providers/cognito"
// import Coinbase from "next-auth/providers/coinbase"
// import Discord from "next-auth/providers/discord"
// import Dropbox from "next-auth/providers/dropbox"
// import Facebook from "next-auth/providers/facebook"
// import GitHub from "next-auth/providers/github"
// import GitLab from "next-auth/providers/gitlab"
// import Google from "next-auth/providers/google"
// import Hubspot from "next-auth/providers/hubspot"
// import Keycloak from "next-auth/providers/keycloak"
// import LinkedIn from "next-auth/providers/linkedin"
// import Netlify from "next-auth/providers/netlify"
// import Okta from "next-auth/providers/okta"
// import Passage from "next-auth/providers/passage"
// import Passkey from "next-auth/providers/passkey"
// import Pinterest from "next-auth/providers/pinterest"
// import Reddit from "next-auth/providers/reddit"
// import Slack from "next-auth/providers/slack"
import Spotify from "next-auth/providers/spotify"
// import Twitch from "next-auth/providers/twitch"
// import Twitter from "next-auth/providers/twitter"
// import WorkOS from "next-auth/providers/workos"
// import Zoom from "next-auth/providers/zoom"
import { createStorage } from "unstorage"
import memoryDriver from "unstorage/drivers/memory"
import vercelKVDriver from "unstorage/drivers/vercel-kv"
import { UnstorageAdapter } from "@auth/unstorage-adapter"
import type { Account, NextAuthConfig } from "next-auth"
import { JWT } from "next-auth/jwt"

const storage = createStorage({
  driver: process.env.VERCEL
    ? vercelKVDriver({
        url: process.env.AUTH_KV_REST_API_URL,
        token: process.env.AUTH_KV_REST_API_TOKEN,
        env: false,
      })
    : memoryDriver(),
})

const config = {
  theme: { logo: "https://authjs.dev/img/logo-sm.png" },
  // adapter: UnstorageAdapter(storage),
  providers: [
    // Apple,
    // Auth0,
    // AzureB2C({
    //   clientId: process.env.AUTH_AZURE_AD_B2C_ID,
    //   clientSecret: process.env.AUTH_AZURE_AD_B2C_SECRET,
    //   issuer: process.env.AUTH_AZURE_AD_B2C_ISSUER,
    // }),
    // BankIDNorway,
    // BoxyHQSAML({
    //   clientId: "dummy",
    //   clientSecret: "dummy",
    //   issuer: process.env.AUTH_BOXYHQ_SAML_ISSUER,
    // }),
    // Cognito,
    // Coinbase,
    // Discord,
    // Dropbox,
    // Facebook,
    // GitHub,
    // GitLab,
    // Google,
    // Hubspot,
    // Keycloak({ name: "Keycloak (bob/bob)" }),
    // LinkedIn,
    // Netlify,
    // Okta,
    // Passkey({
    //   formFields: {
    //     email: {
    //       label: "Username",
    //       required: true,
    //       autocomplete: "username webauthn",
    //     },
    //   },
    // }),
    // Passage,
    // Pinterest,
    // Reddit,
    // Slack,
    Spotify,
    // Twitch,
    // Twitter,
    // WorkOS({
    //   connection: process.env.AUTH_WORKOS_CONNECTION!,
    // }),
    // Zoom,
  ],
  basePath: "/auth",
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl
      if (pathname === "/middleware-example") return !!auth
      return true
    },
    async jwt({ token, trigger, session, account }) {
      if (trigger === "update") token.name = session.user.name
      if (account?.provider === "keycloak") {
        return { ...token, accessToken: account.access_token }
      }
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      } else {
        if (
          typeof token.expiresAt === "number" &&
          typeof token.refreshToken === "string" &&
          // Already refreshing the access token after two minutes to make
          // replication easier:
          Date.now() > ((token.expiresAt * 1000) - (58 * 60 * 1000))
        ) {
          const requestTime = Date.now();
          try {
            const response = await fetch(
              "https://accounts.spotify.com/api/token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  grant_type: "refresh_token",
                  refresh_token: token.refreshToken,
                  client_id: process.env.AUTH_SPOTIFY_ID!,
                }),
              },
            );
            const data = await response.json();
            if (!response.ok) {
              throw data;
            }
            console.log("Refreshed token:", data);
            token.accessToken = data.access_token;
            token.refreshToken = data.refresh_token;
            token.expiresAt = requestTime + data.expires_in * 1000;
          } catch (e) {
            console.log("Could not refresh access token:", e);
            token.error = "RefreshAccessTokenError";
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token?.accessToken) {
        session.accessToken = token.accessToken
        session.expiresAt = token.expiresAt;
        session.error = token.error;
      }
      return session
    },
  },
  experimental: {
    enableWebAuthn: true,
  },
  debug: process.env.NODE_ENV !== "production" ? true : false,
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)

declare module "next-auth" {
  interface Session {
    accessToken?: string
    expiresAt: JWT["expiresAt"] | null;
    error?: "RefreshAccessTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken: Account["refresh_token"];
    expiresAt: Account["expires_at"];
    error?: "RefreshAccessTokenError";
  }
}
