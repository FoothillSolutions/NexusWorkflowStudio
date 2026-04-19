"use client";
import {
  WorkflowNodeType,
  type NodeType,
} from "@/types/workflow";
import type { FormRegister, FormControl, FormSetValue, FormErrors } from "@/nodes/shared/form-types";
import { Fields as PromptFields }       from "@/nodes/prompt/fields";
import { Fields as ScriptFields }       from "@/nodes/script/fields";
import { Fields as SubAgentFields }     from "@/nodes/agent/fields";
import { Fields as ParallelAgentFields } from "@/nodes/parallel-agent/fields";
import { Fields as SubWorkflowFields } from "@/nodes/sub-workflow/fields";
import { Fields as SkillFields }        from "@/nodes/skill/fields";
import { Fields as DocumentFields }     from "@/nodes/document/fields";
import { Fields as McpToolFields }      from "@/nodes/mcp-tool/fields";
import { Fields as HandoffFields }      from "@/nodes/handoff/fields";
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
    case WorkflowNodeType.Prompt:         return <PromptFields control={control} setValue={setValue} nodeId={selectedNodeId} />;
    case WorkflowNodeType.Script:         return <ScriptFields control={control} setValue={setValue} nodeId={selectedNodeId} />;
    case WorkflowNodeType.Agent:          return <SubAgentFields control={control} setValue={setValue} nodeId={selectedNodeId} />;
    case WorkflowNodeType.ParallelAgent:  return <ParallelAgentFields register={register} control={control} setValue={setValue} nodeId={selectedNodeId} />;
    case WorkflowNodeType.SubWorkflow:    return <SubWorkflowFields control={control} setValue={setValue} nodeId={selectedNodeId} />;
    case WorkflowNodeType.Skill:          return <SkillFields register={register} control={control} setValue={setValue} nodeId={selectedNodeId} />;
    case WorkflowNodeType.Document:       return <DocumentFields register={register} control={control} setValue={setValue} />;
    case WorkflowNodeType.McpTool:        return <McpToolFields register={register} />;
    case WorkflowNodeType.Handoff:        return <HandoffFields register={register} control={control} setValue={setValue} />;
    case WorkflowNodeType.IfElse:         return <IfElseFields register={register} control={control} />;
    case WorkflowNodeType.Switch:         return <SwitchFields register={register} control={control} />;
    case WorkflowNodeType.AskUser:        return <AskUserFields register={register} control={control} setValue={setValue} />;
    case WorkflowNodeType.Start:
    case WorkflowNodeType.End:
    default:               return null;
  }
}
