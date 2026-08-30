import { describe, expect, test } from "bun:test";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { SecretStore } from "../src/notion/keychainSecretStore";
import { NotionOAuthProvider } from "../src/notion/oauthProvider";

const CALLBACK_URL = new URL("http://127.0.0.1:43119/callback");

describe("NotionOAuthProvider", () => {
  test("describes a public OAuth client using authorization code and PKCE", () => {
    const provider = createProvider(new MemorySecretStore());

    expect(provider.redirectUrl).toEqual(CALLBACK_URL);
    expect(provider.clientMetadata).toEqual({
      client_name: "Terminal AI Memo",
      redirect_uris: [CALLBACK_URL.toString()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
    expect(provider.state()).toBe(provider.state());
    expect(provider.state().length).toBeGreaterThan(30);
  });

  test("persists client registration and tokens in one secret", async () => {
    const store = new MemorySecretStore();
    const provider = createProvider(store);
    const clientInformation: OAuthClientInformationMixed = {
      client_id: "registered-client",
    };
    const tokens: OAuthTokens = {
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
    };

    await provider.saveClientInformation(clientInformation);
    await provider.saveTokens(tokens);

    const restored = createProvider(store);
    expect(await restored.clientInformation()).toEqual(clientInformation);
    expect(await restored.tokens()).toEqual(tokens);
    expect(store.value).not.toContain("undefined");
  });

  test("forwards the authorization URL to the CLI handler", async () => {
    let redirectedTo: URL | undefined;
    const provider = new NotionOAuthProvider(
      new MemorySecretStore(),
      CALLBACK_URL,
      (url) => {
        redirectedTo = url;
      },
    );
    const authorizationUrl = new URL("https://example.com/authorize");

    await provider.redirectToAuthorization(authorizationUrl);

    expect(redirectedTo).toEqual(authorizationUrl);
  });

  test("keeps the PKCE verifier in memory", () => {
    const provider = createProvider(new MemorySecretStore());

    expect(() => provider.codeVerifier()).toThrow(
      "No PKCE code verifier is available",
    );

    provider.saveCodeVerifier("verifier");
    expect(provider.codeVerifier()).toBe("verifier");
  });

  test("rejects malformed credentials from Keychain", async () => {
    const store = new MemorySecretStore("not-json");
    const provider = createProvider(store);

    expect(provider.tokens()).rejects.toThrow(
      "Stored Notion OAuth credentials are invalid",
    );
  });

  test("can clear only the saved tokens", async () => {
    const store = new MemorySecretStore();
    const provider = createProvider(store);
    await provider.saveClientInformation({ client_id: "client" });
    await provider.saveTokens({
      access_token: "access",
      token_type: "bearer",
    });

    await provider.invalidateCredentials("tokens");

    expect(await provider.clientInformation()).toEqual({
      client_id: "client",
    });
    expect(await provider.tokens()).toBeUndefined();
  });
});

function createProvider(store: SecretStore): NotionOAuthProvider {
  return new NotionOAuthProvider(store, CALLBACK_URL, () => {});
}

class MemorySecretStore implements SecretStore {
  constructor(public value: string | null = null) {}

  async get(): Promise<string | null> {
    return this.value;
  }

  async set(secret: string): Promise<void> {
    this.value = secret;
  }

  async delete(): Promise<void> {
    this.value = null;
  }
}
