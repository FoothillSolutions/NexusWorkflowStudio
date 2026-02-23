"use client";

import type { NodeType } from "@/types/workflow";
import type { FormRegister, FormControl, FormSetValue, FormErrors } from "./types";
import { PromptFields } from "./prompt-fields";
import { SubAgentFields } from "./sub-agent-fields";
import { SubAgentFlowFields } from "./sub-agent-flow-fields";
import { SkillFields } from "./skill-fields";
import { McpToolFields } from "./mcp-tool-fields";
import { IfElseFields } from "./if-else-fields";
import { SwitchFields } from "./switch-fields";
import { AskUserFields } from "./ask-user-fields";

interface TypeSpecificFieldsProps {
  nodeType: NodeType;
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
  errors: FormErrors;
}

export function TypeSpecificFields({
  nodeType,
  register,
  control,
  setValue,
}: TypeSpecificFieldsProps) {
  switch (nodeType) {
    case "prompt":
      return <PromptFields control={control} setValue={setValue} />;
    case "sub-agent":
      return <SubAgentFields control={control} setValue={setValue} />;
    case "sub-agent-flow":
      return <SubAgentFlowFields register={register} />;
    case "skill":
      return <SkillFields register={register} />;
    case "mcp-tool":
      return <McpToolFields register={register} />;
    case "if-else":
      return <IfElseFields register={register} />;
    case "switch":
      return <SwitchFields register={register} control={control} />;
    case "ask-user":
      return <AskUserFields register={register} control={control} />;
    case "start":
    case "end":
    default:
      return null;
  }
}

