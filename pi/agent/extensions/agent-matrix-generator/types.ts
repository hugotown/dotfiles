export type AgentReqs = {
  required?: string[];
  optional?: string[];
  excluded?: string[];
};

export type RoleProfile = {
  name: string;
  patterns: RegExp[];
  required?: string[];
  optional?: string[];
  excluded?: string[];
};

export type ModelCaps = {
  input: string[];
  toolCall: boolean;
  reasoning: boolean;
  attachment: boolean;
};

export type ProviderModel = { providerId: string; modelId: string };

export type ApiModel = {
  modalities?: { input?: string[]; output?: string[] };
  tool_call?: boolean;
  reasoning?: boolean;
  attachment?: boolean;
};

export type CapsByProvider = Map<string, Map<string, ModelCaps>>;

export type SourceFile = { firstLine: string; title: string; body: string };
