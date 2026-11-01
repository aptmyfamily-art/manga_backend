# Project Rules & Agent Execution Hierarchy

This repository follows the **Hierarchical Multi-Agent Architecture** established in [AGENTS.md](./AGENTS.md):

1. **User Interaction**:
   - The user communicates solely with the **Main Lead (หัวหน้าหลัก)**.
   - The Main Lead breaks down tasks and delegates immediately to specialized **Team Leads (หัวหน้าทีม)** via `invoke_subagent`.

2. **Team Organization**:
   - **Main Lead (หัวหน้าหลัก)**: Orchestration, strategy, final synthesis to User.
   - **Team Leads (หัวหน้าทีม)**: Domain-specific leadership (e.g. Connector Lead, Pipeline Lead, Frontend Lead).
   - **Team Members (ลูกทีม)**: Specialized task executors.

3. **Mandatory Sub-Agent Rule**:
   - Always spawn subagents to tackle tasks in parallel.
   - When new features, connectors, or modules are requested, dynamically spin up a new dedicated Team to execute concurrently.

4. **Main Lead Strict Non-Execution Rule**:
   - The Main Lead (Parent Agent) MUST NOT execute dev code, run build/deploy commands, or scrape data directly.
   - The Main Lead MUST NOT poll subagent logs via shell commands (rely strictly on Antigravity's reactive wakeup and messages).
   - All technical tasks belong strictly to Sub-Agents. Main Lead handles orchestration and user reporting only.
