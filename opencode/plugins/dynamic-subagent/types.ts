export interface TextPart {
  type: string;
  text?: string;
}

export interface TextInputPart {
  type: "text";
  text: string;
}

export interface SubagentResponse {
  info: {
    providerID?: string;
    modelID?: string;
    tokens?: { input?: number; output?: number };
    cost?: number;
    error?: unknown;
  };
  parts: TextPart[];
}

export interface SubagentClient {
  session: {
    create(input: {
      body: { parentID: string; title: string };
      query: { directory: string };
    }): Promise<{ data?: { id: string }; error?: unknown }>;
    prompt(input: {
      path: { id: string };
      body: {
        agent: string;
        model: { providerID: string; modelID: string };
        parts: TextInputPart[];
      };
    }): Promise<{ data?: SubagentResponse; error?: unknown }>;
  };
}
