# archon_sldc — progreso, decisiones, quirks y gotchas

Bitácora del diseño de la suite de workflows `archon_sldc_*` (método resolutivo
sobre Archon). De lo particular a lo general: primero la célula worker-de-1-archivo,
después los dispatchers/batches, al final el método completo.

Reglas base heredadas del método: prohibido `output_format`/structured output (R22),
handoffs por archivos `.md` (YAML frontmatter para metadatos máquina, XML/md en el
cuerpo para contenido semántico), stack-agnóstico, workers nunca commitean (R21),
**prohibido modificar la librería Archon** — solo construimos workflows.

---

## Decisiones

### D1 — El worker RECIBE el contrato; NUNCA lo descubre
El sub-workflow `archon_sldc_worker_file` recibe la ruta del archivo de contrato
como `$ARGUMENTS`. Sin fallback de descubrimiento: si `$ARGUMENTS` está vacío o el
archivo no existe → fail-fast con error claro (primer nodo `bash` validador).

**Why:**
- Atomicidad real: `archon workflow run archon_sldc_worker_file <ruta>` es
  reproducible y testeable en aislamiento — la ejecución queda 100% determinada
  por su input.
- Paralelismo sin races: si el worker "descubre el siguiente contrato pendiente",
  dos workers en paralelo toman el mismo. La ASIGNACIÓN es responsabilidad del
  dispatcher (R20, olas ≤7 R9); la EJECUCIÓN es del worker (SRP).
- R19: 1 contrato = 1 archivo lógico = 1 ejecución fresh. El input explícito ES la
  identidad de la ejecución.

### D2 — Contrato de handoff universal para todo `archon_sldc_*`
Todo workflow de la suite cumple el mismo protocolo I/O:
1. **Input** = `$ARGUMENTS`: ruta(s) a archivo(s) `.md` de handoff. Obligatorio.
2. **Output** = archivo `.md` en la ruta declarada DENTRO del input (campo
   `resultPath`), con default derivado por regla determinista
   (`*.contract.md` → `*.result.md` bajo `results/`).
3. Primer nodo: `bash` validador determinista del input (existe, claves requeridas).
4. Último nodo: `bash` validador determinista del output (existe, `status` válido).
5. El output textual del workflow (node output del sink) = 1 línea plana
   `STATUS RUTA_DEL_RESULT` — parseable sin structured output (R22).

### D3 — Stack-agnóstico: los comandos de verificación viajan EN el contrato
El workflow no conoce el stack. Cada contrato declara sus propios comandos
(`verify.lint`, `verify.test`, y los que apliquen). Los nodos gate `bash` los leen
del handoff en vez de hardcodearlos. Esto elimina los `GATE COMMAND PLACEHOLDER`
que hoy tiene `resolutive-execution.yaml`.

### D4 — El handoff loop del worker: siempre termina EN ESTADO (R10)
El loop del worker promete su señal de término (`<promise>WORKER_DONE</promise>`)
tanto en éxito como en bloqueo; el estado REAL (`DONE|BLOCKED`) viaja como dato en
el result file. El error nunca es un exit≠0 del agente (FANOUT-ABORT, R10).
El gate determinista posterior distingue:
- `status: DONE` → re-ejecuta `verify.*` del contrato; si falla → exit 1
  (handoff mentiroso = fallo real del workflow).
- `status: BLOCKED` → exit 0; el bloqueo es DATO para el padre (R11).

### D5 — Handoffs en rutas repo-relativas, NO en `$ARTIFACTS_DIR`
`$ARTIFACTS_DIR` es por-run y vive fuera del repo
(`~/.archon/workspaces/<owner>/<repo>/artifacts/runs/<id>/`) → no sirve como
contrato entre ejecuciones individuales de workflows atómicos. Default de la
suite: `.archon/sldc/` (contracts/, results/, gates/, checkpoints/). El padre
que orquesta puede overridear rutas escribiéndolas en los handoffs.

### D6 — Esquema del CONTRACT MASTER (v0, célula worker)
Archivo `.archon/sldc/contracts/<slug>.contract.md`:

```markdown
---
contractId: <slug>
contractHash: <hash-al-congelar>
phase: A-STUBS | B-TESTS | D-IMPL | F-HARDENING | G-EDGE | I-REFACTOR
targetFile: src/…            # el archivo lógico (impl); tests/fixtures en allowedPaths
allowedPaths:
  - src/…
  - tests/…
dependsOn: []                # aristas de comportamiento (R4)
verify:
  lint: "<comando lint del proyecto, acotado al archivo si es posible>"
  test: "<comando test del proyecto>"
resultPath: .archon/sldc/results/<slug>.<phase>.result.md
---
<contract>
  <interface>… firmas públicas congeladas + tipos …</interface>
  <behavior>… garantías de comportamiento necesarias …</behavior>
  <sentinel>… especificación del test sentinel …</sentinel>
</contract>
```

### D7 — Esquema del RESULT (v0)
Archivo en `resultPath`:

```markdown
---
contractId: <slug>
phase: <fase>
status: DONE | BLOCKED
attempts: <n>
producedBy: archon_sldc_worker_file
workflowRunId: <$WORKFLOW_ID>
---
<result>
  <diff>… resumen acotado de cambios (solo allowedPaths) …</diff>
  <evidence>… tail de lint/test con comando ejecutado …</evidence>
  <blocked reason="…">… solo si BLOCKED: diagnóstico sysdbg, qué se intentó …</blocked>
</result>
```

### D8 — Estado de iteración del loop en ARCHIVO de progreso, no en memoria de sesión
El loop del worker usa `fresh_context: true`; el estado entre iteraciones viaja en
`progressPath` = `resultPath` con `.result.md` → `.progress.md` (qué está hecho,
error verbatim, siguiente paso). El worker lo lee al arrancar cada iteración y lo
BORRA al escribir el result terminal.

**Why:** `$LOOP_PREV_OUTPUT` no está verificado en el binario v0.5.0 (docs van
adelante) y un archivo es consistente con la filosofía R22; además sobrevive a
resume/re-runs.

### D9 — Inyección de skills (R16) vía PROMPT con lecturas obligatorias de SKILL.md
Con provider `opencode` (tiers del config, y por regla del proyecto el provider de
agentes no se sustituye), el campo `skills:` de Archon no aplica (es Claude-only, y
además los nodos `loop:` lo descartan). R16 se cumple instruyendo en el prompt la
lectura COMPLETA y obligatoria de cada `~/.config/opencode/skills/<name>/SKILL.md`
antes de trabajar — el Read del SKILL.md es la señal verificable de carga.
Skills del worker confirmados en disco (también en `~/.claude/skills/`):
test-driven-development, verification-before-completion, systematic-debugging.

**Evidencia adicional (sesión 2, source de main + binario):** el provider
opencode NO tiene ninguna ruta de código para `skills:` a nivel nodo — su
única vía es dentro de defs de `agents:` (agent-fs.ts escribe `skills:` al
frontmatter del agente materializado; que opencode 1.18.3 los precargue desde
ahí no está verificado). El wrapper `dag-node-skills` que sí inyecta skills
por nodo vive SOLO en el provider de Claude. GOTCHA que enmascara esto: el
validador busca skills en `.claude/skills/`/`.agents/skills/` y las nuestras
SÍ existen en `~/.claude/skills/` → `skills:` con opencode "valida ok" y
luego el runtime lo ignora en silencio. Además `capabilities.skills: true`
de opencode se refiere a la vía agents-frontmatter, no al campo de nodo.
Conclusión: D9 (lectura obligatoria de SKILL.md en el prompt, con el Read
como señal verificable de carga) es la única vía que cubre TODOS los roles
(nodos prompt, nodos loop —que descartan campos AI— y subagentes opencode
nativos de D17).

### D10 — Suite de 13 workflows; composición por NESTED RUNS, no include
`include:`/`loop_group:` no existen en v0.5.0 → la composición es:
- Nodos `bash` del padre invocan `archon workflow run <hijo> "<handoff>" --cwd "$PWD"`.
- Hijos NO-interactivos (plan, execute, batch, triage, gates, vertical, células):
  corren inline; el exit code del CLI es la señal de éxito/fallo del nodo.
- Hijos INTERACTIVOS (design, finish): `--detach` + polling de
  `archon workflow get <run-id> --json` en el bash del padre; el humano aprueba
  el RUN HIJO (`archon workflow approve <run-id>`). Cero duplicación de prompts.
- Todos los hijos declaran `worktree: { enabled: false }` (corren en el checkout
  del caller); SOLO `archon_sldc_method` declara `worktree: { enabled: true }`
  y es dueño del aislamiento. Ejecutar un hijo standalone = checkout vivo, que
  es lo esperado para debug/ejecución individual.

Mapa de la suite (todas en `~/.config/archon/workflows/`, prefijo `archon_sldc_`):

| Workflow | Rol | Modelo |
|---|---|---|
| `archon_sldc_worker_file` | célula: 1 task (contrato+fase) → result | medium |
| `archon_sldc_reviewer_file` | célula: review de 1 result | small |
| `archon_sldc_fixer_file` | célula: aplica findings a 1 archivo | medium |
| `archon_sldc_batch` | fase horizontal genérica (olas ≤7 + review + fix + gate) | medium |
| `archon_sldc_triage` | fase H: triage central + fanout afectados | large/medium |
| `archon_sldc_vertical` | topología vertical: slices ∥/topológicos | medium |
| `archon_sldc_gate_contract_review` | R18 singleton semántico post-stubs | large |
| `archon_sldc_gate_e_global` | R7: suite+lint determinista + review cross-file | large |
| `archon_sldc_design` | pasos 0–2: brainstorm interactivo + oracle + HARD GATE | medium/large |
| `archon_sldc_plan` | paso 3: writing-plans → contratos+grafo+topología | large |
| `archon_sldc_execute` | pasos 5–11: stubs→gates→batches→commit único | medium |
| `archon_sldc_finish` | paso 12: finishing humano + ejecutor | medium |
| `archon_sldc_method` | raíz: secuencia design→plan→execute→finish | medium |

### D11 — Olas con provider opencode: `agents:` = archivos materializados + task tool
Verificado en source (packages/providers/src/community/opencode) y strings del
binario v0.5.0:
- Archon materializa cada entrada de `agents:` como
  `<cwd>/.opencode/agents/archon-<key>.md` (`mode: subagent`, description,
  model, skills, tools) — `agent-fs.ts`, string `opencode.agent_fs` presente
  en el binario.
- v0.5.0 NO tiene el multi-agent fanout de main: `selectSingleAgent` usa el
  PRIMER agent del mapa como agente de la sesión (warning
  `multiple_agents_configured_using_first`). → REGLA: el DISPATCHER va primero
  en `agents:`; workers/reviewers/fixers después, y el dispatcher los invoca
  como subagentes opencode NATIVOS vía task tool por nombre `archon-<key>`.
- `model:` dentro de una def de agent es ref LITERAL `provider/model`
  (parseModelRef); los tiers small/medium/large solo aplican a nivel nodo.
- RIESGO ABIERTO (verificar en smoke run): opencode 1.18.3 podría buscar
  `.opencode/agent/` (singular) y no `agents/`. Plan B si falla: nodo bash
  propio materializa los mismos archivos en el dir correcto (idempotente).

### D12 — Worker input = TASK file; el CONTRACT MASTER pierde `phase:` (rev. D6)
R19/R20: el contrato se congela UNA vez y se reutiliza en TODAS las fases → no
puede llevar `phase:`/`resultPath:` fijos (eso era D6 v0, pensado para la
célula suelta). Corrección:
- `*.contract.md` (master, congelado por plan): sin phase; conserva
  contractId/hash, targetFile, allowedPaths, dependsOn, verify.*, interface/
  behavior/sentinel en el cuerpo. Opcional `phases:` (lista) si el planner
  excluye fases; default = elegible en todas.
- El input de worker/fixer es un `*.task.md` GENERADO determinísticamente
  (por `archon_sldc_execute`/`archon_sldc_batch`, o a mano para runs sueltos):
  frontmatter `contractPath, phase, resultPath, progressPath, attempt`.
- D1 se mantiene: el worker recibe la ruta del task file en `$ARGUMENTS`,
  jamás descubre trabajo.

### D13 — Batch genérico único parametrizado por MANIFEST de fase (DRY)
Un solo `archon_sldc_batch` sirve A/B/D/F/G/I; la fase viaja como dato en el
manifest `.archon/sldc/batches/<phase>.batch.md`. El gate del batch es
DETERMINISTA vía `until_bash` del loop: todos los results DONE + reviews sin
critical + comandos `gateSuite`/`gateLint` del manifest en verde → exit 0.
`until:` (obligatorio en v0.5.0) queda como señal backstop que el prompt tiene
prohibido emitir; `max_iterations` es estático (YAML no puede leerlo del
manifest). Loop agota iteraciones → el workflow FALLA → escalación R11 al
caller como fallo de nodo.

### D14 — Workflows-gate: exit ≠0 en FAIL; el padre los corre con `|| true`
Los gates semánticos (`gate_contract_review`, `gate_e_global`) terminan con un
nodo bash que sale ≠0 si el verdict file no es PASS (fail-closed: archivo
ausente/ inválido = FAIL). Standalone: el exit code ES el gate. En composición,
`archon_sldc_execute` los invoca con `|| true`, relee el verdict file
determinísticamente y enruta con `when:` — FAIL de R18 → nodo `cancel` (HALT,
como pide la regla), FAIL de GATE E → nodo bash exit 1 (run failed, resumable).

### D15 — Frontmatter de handoffs: PLANO y line-oriented (parseable con sed/grep)
Prohibido depender de yq/jq para YAML (stack-agnóstico, sin deps). Los lectores
deterministas parsean frontmatter con sed/awk → claves planas de una línea
(`status: DONE`, `gateSuite: "npm test"`), listas como líneas `- item` bajo la
clave. Nada de estructuras anidadas en frontmatter; lo semántico/jerárquico va
en el cuerpo XML.

### D16 — El commit único (R17) EXCLUYE `.archon/` y `.opencode/`
`final-commit` usa `git add -A -- . ':(exclude).archon' ':(exclude).opencode'`:
los handoffs y los agentes materializados son telemetría/infra del método, no
producto. Quien quiera preservarlos los archiva fuera o los commitea a mano.

### D17 — Los subagentes de ola NO dependen del campo `agents:` de Archon
Verificado en runtime: `agents:` se DESCARTA en nodos `loop:`
(`loop_node_ai_fields_ignored`). Por eso batch/triage/vertical materializan
ellos mismos los agentes opencode con un nodo bash determinista e idempotente:
`.opencode/agent/sldc-*.md` Y `.opencode/agents/sldc-*.md` (ambos dirs, por
diferencias de versión de opencode), SIN prefijo `archon-` (el cleanup de
`agent-fs.ts` borra `archon-*` que no estén en el request actual). El
dispatcher (sesión opencode default) los invoca por nombre con el task tool
nativo. **CONFIRMADO en smoke run**: la review del batch salió con
`producedBy: sldc-file-reviewer` — el task tool sí encontró y ejecutó el
subagente materializado.

---

## Contratos de handoff de la suite (protocolo D2 aplicado)

Raíz: `.archon/sldc/` (repo-relativa, D5). Convención de salida del sink:
1 línea `STATUS RUTA` (R22). Todos los archivos son `.md` = frontmatter YAML
plano (D15) + cuerpo XML.

**`archon_sldc_worker_file`** — IN `$ARGUMENTS`: ruta a `*.task.md`
(`contractPath, phase, resultPath, progressPath, attempt`). OUT: result en
`resultPath` (D7: `status: DONE|BLOCKED` + `<result><diff/><evidence/>
<blocked/></result>`). Gate final: DONE → re-ejecuta `verify.*` del contrato
(mentira = exit 1); BLOCKED → exit 0 (el bloqueo es DATO, R10/R11).

**`archon_sldc_reviewer_file`** — IN: ruta a `*.review-request.md`
(`contractPath, resultPath, phase, reviewPath`). OUT: review en `reviewPath`
(`verdict: APPROVED|FINDINGS`, `critical/important/minor: <n>` + cuerpo
`<review><finding severity=…/></review>`). No toca código, no commitea.

**`archon_sldc_fixer_file`** — IN: ruta a `*.fix-request.md` (`contractPath,
phase, reviewPath, resultPath, progressPath, attempt`). OUT: result actualizado
(mismo esquema D7). Evalúa findings con criterio (puede rebatir en el result);
re-verifica con `verify.*`.

**`archon_sldc_batch`** — IN: ruta a `*.batch.md` (`phase,
resultsDir, gateSuite, gateLint, checkpointPath, waveSize: 7` + lista `tasks:`
de rutas `*.task.md`). OUT: checkpoint en `checkpointPath` (resumen de results/
reviews + evidencia del gate). Falla si agota rondas sin gate verde.

**`archon_sldc_triage`** — IN: ruta a `*.triage-request.md` (`contractsDir,
executionDir, triagePath, resultsDir, checkpointPath, gateSuite, gateLint`).
OUT: `triage.md` (afectados + causas raíz + re-freeze propuesto) + results del
fanout + checkpoint. Re-freeze: SE EDITA EL CONTRATO PRIMERO, el código después
(R13).

**`archon_sldc_gate_contract_review`** — IN: ruta a `*.gate-request.md`
(`contractsDir, stubsResultsDir, reviewPath, verdictPath`). OUT: review +
verdict file de UNA palabra `PASS|FAIL`. Exit ≠0 si FAIL (D14).

**`archon_sldc_gate_e_global`** — IN: ruta a `*.gate-request.md` (`gateSuite,
gateLint, contractsDir, executionDir, reviewPath, verdictPath`). OUT: evidencia
determinista + review cross-file + verdict `PASS|FAIL`. Exit ≠0 si FAIL.

**`archon_sldc_design`** — IN `$ARGUMENTS`: texto de la idea/PRD (única entrada
no-archivo de la suite: no existe artefacto previo). OUT:
`design/spec-candidate.md`, `design/design-verification.md`,
`design/spec-approved.md` (congelado tras HARD GATE, con `specHash`).
Interactivo: loop de brainstorming (intervención #1) + approval (intervención #2).

**`archon_sldc_plan`** — IN: ruta a `design/spec-approved.md`. OUT:
`planning/planning-handoff.md` (plan A–I + grafo de comportamiento + densidad +
`gateSuite`/`gateLint` del proyecto), `planning/contracts/<slug>.contract.md`
(masters congelados, D12), `planning/topology.txt` (`VERTICAL|HORIZONTAL`).

**`archon_sldc_execute`** — IN: ruta a `*.execute-request.md`
(`planningHandoff, contractsDir, topologyPath, sldcRoot`). OUT: todo el árbol
`execution/` + gates + EL ÚNICO COMMIT (R17, D16). Orquesta nested runs:
batch A → gate R18 (FAIL→cancel) → vertical | batches B,D,F,G, triage H,
batch I → gate E global (FAIL→exit 1 resumable) → commit.

**`archon_sldc_finish`** — IN: ruta opcional a `*.finish-request.md` (defaults
derivables). Approval humano `MERGE|PR|KEEP|DISCARD` (intervención #3) +
ejecutor con finishing-a-development-branch. OUT:
`finishing/finishing-report.md`. Nunca commitea (el commit ya existe).

**`archon_sldc_method`** — IN `$ARGUMENTS`: idea/PRD. Secuencia D10 con
worktree propio. OUT: los de todas las etapas + reporte final.

---

## Quirks / gotchas del BINARIO instalado (Archon CLI v0.5.0, verificado empíricamente)

- **El binario v0.5.0 va DETRÁS de los docs de `main`.** `update-check.json`
  confirma que 0.5.0 es la última release. Tipos de nodo soportados por el loader
  (mensaje de error literal): `command | prompt | bash | loop | approval |
  cancel | script`. **NO existen `loop_group:` ni `include:`.**
- **⚠ La suite `resolutive-*` completa NO carga en v0.5.0**: usa `include` y
  `loop_group`, así que ninguno de los 4 workflows aparece en
  `archon workflow list`. El commit d7b36a22 shipeó workflows que el binario
  instalado no puede parsear. La suite `archon_sldc_*` se diseña contra lo que
  v0.5.0 realmente soporta.
- **Providers registrados en este build**: `claude, codex, opencode, pi,
  copilot`. La validación de provider es real (probé un provider falso y el
  loader lo rechaza); `provider: opencode` + `model: medium` (tier) +
  `until_bash` validan OK.
- **`~/.archon` es symlink a `~/.config/archon`** → `workflows/` de este repo ES
  el directorio de workflows globales.
- **El loader acepta campos que quizá no ejecuta** (`always_run`, `output_type`,
  `worktree:` workflow-level validan en 0.5.0 sin error aunque los docs sean de
  main) — no tratar "valida ok" como prueba de funcionalidad; probar en runtime.
- **Workflows de PROYECTO se descubren en `.archon/workflows/`** (no en
  `workflows/` a secas); `workflows/` solo funciona en `~/.config/archon`
  porque ese repo ES `~/.archon` (dir global). `archon` exige correr dentro de
  un repo git (o `--cwd` a uno).
- **Probes que VALIDAN en v0.5.0** (2026-07-16): `agents:` en nodos prompt Y
  loop; `approval:` con `capture_response` + `on_reject.{prompt,max_attempts}`;
  `when:` con `$node.output ==/!=`; `trigger_rule: none_failed_min_one_success`;
  `context: fresh`; `output_type`; `always_run`; `cancel`. `retry:` debe ser
  OBJETO (`{max_attempts: n}`), no número. `loop.until` es SIEMPRE obligatorio
  (string); `until_bash` es complementario, no sustituto.
- **Strings presentes en el binario** (runtime wiring confirmado):
  `$LOOP_PREV_OUTPUT`, `until_bash`, `LOOP_USER_INPUT`, `gate_message`,
  `capture_response`, `on_reject`/`REJECTION_REASON`, `trigger_rule`/
  `none_failed_min_one_success`, `always_run`. `loop_group`: CERO ocurrencias.
- **Provider opencode en v0.5.0**: materializa `agents:` como
  `<cwd>/.opencode/agents/archon-<key>.md` pero usa SOLO el primer agent como
  agente de sesión (ver D11). Capabilities de main: `skills: true, agents:
  true, structuredOutput: enforced, effortControl: false`.
- **CLI v0.5.0**: `--no-worktree`, `--cwd`, `--resume`, `--detach`,
  `--conversation-id`, `--json` existen. `$ARGUMENTS` = argumento posicional
  `[msg]` tras el nombre del workflow.
- **Los workflows bundled están embebidos en el binario** como template
  strings JS — extraíbles con `grep -a` para ver sintaxis runtime-proven.
- **🔴 BUG FATAL v0.5.0 + opencode en darwin: self-SIGKILL (exit 137).**
  `findProcessByPort` usa `lsof -ti:PORT` SIN `-sTCP:LISTEN`: lista también a
  los CLIENTES del puerto (incluido el propio proceso archon) y el kill de
  "proceso stale" mata a archon mismo al arrancar CUALQUIER sesión opencode.
  Reproducido con un workflow mínimo de 1 nodo prompt. El FIX ya existe como
  **parche local no commiteado** en el working copy del vault
  (`Archon/packages/providers/src/community/opencode/runtime.ts`: filtro
  LISTEN + guard `refusing_self_kill`) — una sesión anterior ya lo había
  diagnosticado. El binario instalado `/usr/local/bin/archon` NO lo lleva.
  WORKAROUND en uso: shim `archon` → `bun <vault>/packages/cli/src/cli.ts`
  (Build: source). Con el shim, todo funciona.
- **`--detach` NO imprime el run id** (v0.5.0/source): se resuelve vía
  `archon workflow runs --json` filtrando por `workflow_name` (más reciente
  primero). `archon_sldc_method` ya lo hace así.
- **Los short run-ids (8 chars) NO funcionan** en `workflow get/abandon` de
  v0.5.0 (feature de main): usar SIEMPRE el id completo de 32 hex.
- **Runs huérfanos dejan LOCK por path**: si el proceso CLI muere, el run
  queda `running` para siempre y bloquea nuevos runs en ese checkout
  ("This worktree is in use"). Limpiar con `archon workflow abandon <id-32>`.
- **Repos sin `origin` disparan `base_branch_auto_detect_failed`**: warning
  inofensivo con `--no-worktree`/`worktree.enabled: false`, pero FATAL si el
  run intenta crear worktree. Para repos locales: `worktree.baseBranch` en
  `.archon/config.yaml` o tener origin.
- **Footgun de parsers de frontmatter**: una lista al FINAL del frontmatter
  ("tasks:") es seguida por el delimitador `---`, que MATCHEA `^-` — el
  parser de listas debe exigir `- ` (guion+espacio) y cortar en `/^---$/`.
  (Bug real encontrado en smoke: item fantasma `--`.)
- **El error del title-generator** ("OpenCode requires a model to be
  specified") es cosmético: el defaultAssistant no tiene modelo; los nodos
  resuelven su tier bien. Silenciable configurando `assistants.opencode.model`
  o `defaultAssistant` en config.yaml.

## Quirks / gotchas de Archon (verificados en docs)

- **`include:` NO soporta `with:`** (Phase 1): no se pueden pasar parámetros a un
  sub-workflow incluido, ni hacer N instancias con args distintos. Un bloque
  incluido solo ve variables de workflow y ARCHIVOS. → La composición N×archivo
  del método sigue siendo vía dispatcher AI + sub-agents inline (`agents:` +
  Task tool), no vía N includes del worker-workflow. El worker-workflow atómico
  sirve para (a) ejecución/debug individual y (b) ser la ESPECIFICACIÓN cuyo
  protocolo replica el prompt del sub-agent del dispatcher.
- **`include:` ignora los campos workflow-level del hijo** (provider/model/
  worktree/…): el padre gobierna; overrides solo per-node.
- **`$ARGUMENTS`/`$USER_MESSAGE`** llegan a todos los tipos de nodo; `$1..$9`
  solo aplican a comandos invocados directamente (fuera de workflows) — no
  contar con posicionales dentro del DAG.
- **Footgun de bash:** NUNCA `var="$node.output"` (doble comilla rompe el caso
  inline pre-quoted). Siempre `var=$node.output`.
- **`when:` fail-closed:** expresión inválida = false = nodo skipped con warning.
  Los lectores deterministas de veredicto (patrón `read-*-verdict` bash) deben
  degradar a `FAIL` explícito ante archivo faltante/ inválido.
- **Resume cachea nodos exitosos:** nodos `bash` lectores de archivos que pueden
  cambiar entre resume y resume necesitan `always_run: true`.
- **Nested `archon workflow run` desde un nodo bash** existe como opción de
  fanout pero cada run puede crear su propio worktree → habría que forzar
  `--no-worktree` y serializar. No es el mecanismo preferido para olas.
- **`loop:` no acepta `retry:`** y maneja su propia iteración; `$LOOP_PREV_OUTPUT`
  (loop) y `$LOOP_PREV.<nodeId>.output` (loop_group) son la vía para pasar
  hallazgos entre iteraciones con `fresh_context: true`.

---

## Progreso

- 2026-07-16 — Arranque de la suite `archon_sldc_*`. Decidido D1–D7 (célula
  worker-de-1-archivo + protocolo universal de handoff).
- 2026-07-16 — D6/D7 aprobados por el humano. Materializado
  `workflows/archon_sldc_worker_file.yaml` (validate-contract → loop implement →
  verify-result), **valida OK con `archon validate workflows` en v0.5.0**.
  Adaptaciones forzadas por el binario: `loop:` plano (no hay `loop_group`),
  D8 (progress file) y D9 (skills vía prompt). Hallazgo colateral: la suite
  `resolutive-*` no carga en v0.5.0. Siguiente: contrato de ejemplo + smoke run
  de la célula, luego subir de nivel (reviewer de 1 archivo → dispatcher de ola
  → batches → método completo).
- 2026-07-16 (sesión 2) — ⚠ `workflows/` apareció VACÍO al arrancar: el
  `archon_sldc_worker_file.yaml` de la sesión 1 se perdió (nunca se commiteó) y
  los `resolutive-*.yaml` están borrados sin stage (recuperables de HEAD; se
  copiaron a scratchpad como referencia). Lección: commitear los workflows en
  cuanto validen. Decididos D10–D16 (suite de 13, nested runs, agents opencode,
  task files, batch genérico, gates exit≠0, frontmatter plano, commit excluye
  .archon/). Definidos los contratos de handoff de TODA la suite (sección
  nueva). Confirmación empírica amplia del binario v0.5.0 (probes + grep del
  binario + source de main). En curso: materializar los 13 YAML.
- 2026-07-16 (sesión 2, cierre) — **SUITE COMPLETA: 13/13 workflows validan**
  en `~/.config/archon/workflows/` (worker/reviewer/fixer células, batch,
  triage, vertical, 2 gates, design/plan/execute/finish/method). D17 añadida.
  **Smoke runs VERDES** (fixture `greet` shell en scratchpad):
  1. `archon_sldc_worker_file` → implement loop 1 iteración, result D7
     `status: DONE`, progress borrado (D8), re-verificación determinista OK,
     sink `DONE <path>`, git intacto.
  2. `archon_sldc_reviewer_file` (tier small/MiniMax) → verdict APPROVED con
     re-ejecución propia de los comandos verify.
  3. `archon_sldc_batch` → materializó subagentes, el dispatcher despachó
     `sldc-file-reviewer` vía task tool nativo, gate determinista
     (until_bash) pasó, checkpoint XML válido. (~$0.01–0.05/run smoke)
  Hallazgo mayor: bug fatal darwin v0.5.0 opencode (self-SIGKILL 137) — ver
  quirks; el parche local del vault + shim `bun .../cli.ts` lo resuelve.
  PENDIENTE: decidir cómo instalar archon parcheado de forma permanente
  (recompilar binario vs shim en PATH); smoke de un ciclo horizontal completo
  con `archon_sldc_execute`; commitear los workflows (¡no se ha vuelto a
  perder trabajo de milagro — commitear ya!).
