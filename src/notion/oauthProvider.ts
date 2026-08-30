import { randomBytes } from "node:crypto";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { SecretStore } from "./keychainSecretStore";
import { PRODUCT_NAME } from "../appMetadata";

type StoredOAuthCredentials = {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
};

export type AuthorizationRedirectHandler = (
  authorizationUrl: URL,
) => void | Promise<void>;

export class NotionOAuthProvider implements OAuthClientProvider {
  private readonly oauthState = randomBytes(32).toString("base64url");
  private codeVerifierValue?: string;
  private storedCredentials?: Promise<StoredOAuthCredentials>;

  constructor(
    private readonly secretStore: SecretStore,
    private readonly callbackUrl: URL,
    private readonly onAuthorizationRedirect: AuthorizationRedirectHandler,
  ) {}

  get redirectUrl(): URL {
    return this.callbackUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: PRODUCT_NAME,
      redirect_uris: [this.callbackUrl.toString()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  state(): string {
    return this.oauthState;
  }

  clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    return this.loadCredentials().then(
      (credentials) => credentials.clientInformation,
    );
  }

  async saveClientInformation(
    clientInformation: OAuthClientInformationMixed,
  ): Promise<void> {
    await this.updateCredentials({ clientInformation });
  }

  tokens(): Promise<OAuthTokens | undefined> {
    return this.loadCredentials().then((credentials) => credentials.tokens);
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.updateCredentials({ tokens });
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.onAuthorizationRedirect(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.codeVerifierValue = codeVerifier;
  }

  codeVerifier(): string {
    if (!this.codeVerifierValue) {
      throw new Error("No PKCE code verifier is available");
    }

    return this.codeVerifierValue;
  }

  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
  ): Promise<void> {
    if (scope === "verifier") {
      this.codeVerifierValue = undefined;
      return;
    }

    if (scope === "discovery") {
      return;
    }

    if (scope === "all") {
      this.codeVerifierValue = undefined;
      this.storedCredentials = Promise.resolve({});
      await this.secretStore.delete();
      return;
    }

    const current = await this.loadCredentials();
    const next = { ...current };

    if (scope === "client") {
      delete next.clientInformation;
    } else {
      delete next.tokens;
    }

    await this.saveCredentials(next);
  }

  private loadCredentials(): Promise<StoredOAuthCredentials> {
    this.storedCredentials ??= this.readCredentials();
    return this.storedCredentials;
  }

  private async readCredentials(): Promise<StoredOAuthCredentials> {
    const storedValue = await this.secretStore.get();

    if (storedValue === null) {
      return {};
    }

    try {
      const parsed: unknown = JSON.parse(storedValue);

      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("expected an object");
      }

      return parsed as StoredOAuthCredentials;
    } catch {
      throw new Error("Stored Notion OAuth credentials are invalid");
    }
  }

  private async updateCredentials(
    patch: Partial<StoredOAuthCredentials>,
  ): Promise<void> {
    const current = await this.loadCredentials();
    await this.saveCredentials({ ...current, ...patch });
  }

  private async saveCredentials(
    credentials: StoredOAuthCredentials,
  ): Promise<void> {
    await this.secretStore.set(JSON.stringify(credentials));
    this.storedCredentials = Promise.resolve(credentials);
  }
}
