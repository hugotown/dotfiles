/** Static artifact types derived from the phase contracts. */
import type { Static } from "@sinclair/typebox";
import { BrainstormContract, BrainstormRoundContract } from "./brainstorm.ts";
import { ApprovalGateContract, SpecReviewContract, WriteSpecContract } from "./finalize.ts";
import { CollectTreeContract, ContextExtractContract } from "./grounding.ts";
import { PreflightContract } from "./preflight.ts";

export type PreflightArtifact = Static<typeof PreflightContract>;
export type CollectTreeArtifact = Static<typeof CollectTreeContract>;
export type ContextExtractArtifact = Static<typeof ContextExtractContract>;
export type BrainstormRoundArtifact = Static<typeof BrainstormRoundContract>;
export type BrainstormArtifact = Static<typeof BrainstormContract>;
export type ApprovalGateArtifact = Static<typeof ApprovalGateContract>;
export type WriteSpecArtifact = Static<typeof WriteSpecContract>;
export type SpecReviewArtifact = Static<typeof SpecReviewContract>;
