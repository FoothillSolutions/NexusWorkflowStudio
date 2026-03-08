---
description: my-workflow
---
```mermaid
flowchart TD
    start_node_default([Start])
    end_node_default([End])
    question_1772218260768{AskUserQuestion:<br/>What language to use?}
    prompt_1772221261916[Enter your prompt here.]

    start_node_default --> question_1772218260768
    question_1772218260768 --> end_node_default
    question_1772218260768 --> prompt_1772221261916
    prompt_1772221261916 --> end_node_default
```

## Workflow Execution Guide

Follow the Mermaid flowchart above to execute the workflow. Each node type has specific execution methods as described below.

### Execution Methods by Node Type

- **Rectangle nodes (Sub-Agent: ...)**: Execute Sub-Agents
- **Diamond nodes (AskUserQuestion:...)**: Use the AskUserQuestion tool to prompt the user and branch based on their response
- **Diamond nodes (Branch/Switch:...)**: Automatically branch based on the results of previous processing (see details section)
- **Rectangle nodes (Prompt nodes)**: Execute the prompts described in the details section below

### Prompt Node Details

#### prompt_1772221261916(Enter your prompt here.)

```
Enter your prompt here.

You can use variables like {{variableName}}.
```

### AskUserQuestion Node Details

Ask the user and proceed based on their choice.

#### question_1772218260768(What language to use?)

**Selection mode:** Multi-select enabled (a list of selected options is passed to the next node)

**Options:**
- **Option 1**: New option
- **Option 2**: New option
