"use client";
import type { NodeType } from "@/types/workflow";
import type { FormRegister, FormControl, FormSetValue, FormErrors } from "@/nodes/shared/form-types";
import { Fields as PromptFields }       from "@/nodes/prompt/fields";
import { Fields as SubAgentFields }     from "@/nodes/sub-agent/fields";
import { Fields as SubAgentFlowFields } from "@/nodes/sub-agent-flow/fields";
import { Fields as SkillFields }        from "@/nodes/skill/fields";
import { Fields as McpToolFields }      from "@/nodes/mcp-tool/fields";
import { Fields as IfElseFields }       from "@/nodes/if-else/fields";
import { Fields as SwitchFields }       from "@/nodes/switch/fields";
import { Fields as AskUserFields }      from "@/nodes/ask-user/fields";

interface TypeSpecificFieldsProps {
  nodeType: NodeType;
  register: FormRegister;
  control: FormControl;
  setValue: FormSetValue;
  errors: FormErrors;
  selectedNodeId?: string;
}

export function TypeSpecificFields({ nodeType, register, control, setValue, selectedNodeId }: TypeSpecificFieldsProps) {
  switch (nodeType) {
    case "prompt":         return <PromptFields control={control} setValue={setValue} />;
    case "agent":          return <SubAgentFields control={control} setValue={setValue} nodeId={selectedNodeId} />;
    case "sub-workflow":   return <SubAgentFlowFields register={register} />;
    case "skill":          return <SkillFields register={register} control={control} setValue={setValue} />;
    case "mcp-tool":       return <McpToolFields register={register} />;
    case "if-else":        return <IfElseFields register={register} control={control} />;
    case "switch":         return <SwitchFields register={register} control={control} />;
    case "ask-user":       return <AskUserFields register={register} control={control} />;
    case "start":
    case "end":
    default:               return null;
  }
}