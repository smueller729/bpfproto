import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import '../styles/App.css'
import '../styles/index.css'

type StageStatus = 'completed' | 'inProgress' | 'skipped' | 'returned'

type LoadState = 'loading' | 'ready' | 'error'

type WorkflowStage = {
  id: string
  stage: string
  sequenceNumber: number
  description: string
  workflowName: string
  workflowDescription: string
}

type DataverseWorkflowStageRow = {
  usgs_workflowstageid?: string
  usgs_stage: string
  usgs_sequencenumber: number
  usgs_description?: string
  'W.usgs_name'?: string
  'W.usgs_description'?: string
  'W.usgs_stagescount'?: number
  'W.usgs_workflowid'?: string
}

type WorkflowAction = {
  id: string
  label: string
  targetSequence: number
  helpText: string
}

type StageViewModel = WorkflowStage & {
  status: StageStatus
  isCurrent: boolean
  isDestination: boolean
}

type XrmWebApi = {
  retrieveMultipleRecords: (
    entityLogicalName: string,
    options?: string,
  ) => Promise<{ entities: DataverseWorkflowStageRow[] }>
}

type XrmContext = {
  WebApi: XrmWebApi
}

declare global {
  interface Window {
    Xrm?: XrmContext
  }
}

const currentSequence = 3

const fetchXml = `<fetch xmlns:generator='MarkMpn.SQL4CDS'>
  <entity name='usgs_workflowstage'>
    <attribute name='usgs_stage' />
    <attribute name='usgs_sequencenumber' />
    <attribute name='usgs_description' />
    <link-entity name='usgs_workflow' to='usgs_workflow' from='usgs_workflowid' alias='W' link-type='inner'>
      <attribute name='usgs_name' />
      <attribute name='usgs_description' />
      <attribute name='usgs_stagescount' />
      <attribute name='usgs_workflowid' />
      <filter>
        <condition attribute='usgs_workflowid' operator='eq' value='da4215da-44fd-f011-8407-001dd80bcb40' />
      </filter>
    </link-entity>
    <order attribute='usgs_sequencenumber' />
  </entity>
</fetch>`

const workflowActions: WorkflowAction[] = [
  {
    id: 'submit-technical-review',
    label: 'Submit to Technical Review',
    targetSequence: 4,
    helpText: 'Moves the product forward to the next reviewer.',
  },
  {
    id: 'send-publishing-approval',
    label: 'Send to Publishing Approval',
    targetSequence: 5,
    helpText: 'Moves forward and skips Technical Review for this form path.',
  },
  {
    id: 'return-program-validation',
    label: 'Return to Program Validation',
    targetSequence: 2,
    helpText: 'Routes backward because required validation is incomplete.',
  },
  {
    id: 'return-intake-review',
    label: 'Return to Intake Review',
    targetSequence: 1,
    helpText: 'Routes backward to the original intake team.',
  },
]

const statusContent: Record<StageStatus, { label: string; icon: string }> = {
  completed: { label: 'Completed', icon: 'check' },
  inProgress: { label: 'In progress', icon: 'progress' },
  skipped: { label: 'Skipped', icon: 'skip' },
  returned: { label: 'Returned', icon: 'return' },
}

function getXrmContext(): XrmContext | undefined {
  if (window.Xrm?.WebApi) {
    return window.Xrm
  }

  try {
    return window.parent?.Xrm?.WebApi ? window.parent.Xrm : undefined
  } catch {
    return undefined
  }
}

async function fetchWorkflowStages(): Promise<{
  rows: DataverseWorkflowStageRow[]
  source: string
}> {
  const xrm = getXrmContext()

  if (!xrm) {
    throw new Error(
      'Dataverse context is unavailable. Host this PCF control in a model-driven app so Xrm.WebApi can run the FetchXML query.',
    )
  }

  const response = await xrm.WebApi.retrieveMultipleRecords(
    'usgs_workflowstage',
    `?fetchXml=${encodeURIComponent(fetchXml)}`,
  )

  return { rows: response.entities, source: 'Dataverse FetchXML query' }
}

function normalizeWorkflowStages(rows: DataverseWorkflowStageRow[]): WorkflowStage[] {
  return rows
    .map((row) => ({
      id:
        row.usgs_workflowstageid ??
        `${row['W.usgs_workflowid'] ?? 'workflow'}-${row.usgs_sequencenumber}`,
      stage: row.usgs_stage,
      sequenceNumber: row.usgs_sequencenumber,
      description: row.usgs_description ?? '',
      workflowName: row['W.usgs_name'] ?? 'Workflow',
      workflowDescription: row['W.usgs_description'] ?? '',
    }))
    .sort((left, right) => left.sequenceNumber - right.sequenceNumber)
}

function getStageStatus(
  sequenceNumber: number,
  current: number,
  destination: number,
): StageStatus {
  if (destination === current) {
    return sequenceNumber < current
      ? 'completed'
      : sequenceNumber === current
        ? 'inProgress'
        : 'skipped'
  }

  if (destination > current) {
    if (sequenceNumber <= current) {
      return 'completed'
    }

    return sequenceNumber === destination ? 'inProgress' : 'skipped'
  }

  if (sequenceNumber < destination) {
    return 'completed'
  }

  if (sequenceNumber <= current) {
    return 'returned'
  }

  return 'skipped'
}

function buildStageViewModels(
  stages: WorkflowStage[],
  selectedAction: WorkflowAction,
): StageViewModel[] {
  return stages.map((stage) => ({
    ...stage,
    status: getStageStatus(
      stage.sequenceNumber,
      currentSequence,
      selectedAction.targetSequence,
    ),
    isCurrent: stage.sequenceNumber === currentSequence,
    isDestination: stage.sequenceNumber === selectedAction.targetSequence,
  }))
}

function StatusIcon({ status }: { status: StageStatus }) {
  const iconType = statusContent[status].icon

  return (
    <span className="statusIcon" aria-hidden="true">
      {iconType === 'check' && (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="m7.6 13.8-3.4-3.4 1.4-1.4 2 2 5.8-5.8 1.4 1.4-7.2 7.2Z" />
        </svg>
      )}
      {iconType === 'progress' && (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M10 3a7 7 0 1 0 7 7h-2a5 5 0 1 1-5-5V3Z" />
          <path d="M11 3v7h6a7 7 0 0 0-6-7Z" />
        </svg>
      )}
      {iconType === 'skip' && (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M4 9h8.2L9.6 6.4 11 5l5 5-5 5-1.4-1.4 2.6-2.6H4V9Z" />
          <path d="M15 5h2v10h-2V5Z" />
        </svg>
      )}
      {iconType === 'return' && (
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M8 4 3 9l5 5 1.4-1.4L6.8 10H13a3 3 0 0 1 0 6h-2v2h2a5 5 0 0 0 0-10H6.8l2.6-2.6L8 4Z" />
        </svg>
      )}
    </span>
  )
}

function App(): React.ReactElement {
  const [rows, setRows] = useState<DataverseWorkflowStageRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [sourceLabel, setSourceLabel] = useState('Loading workflow stages.')
  const stages = useMemo(() => normalizeWorkflowStages(rows), [rows])
  const [selectedActionId, setSelectedActionId] = useState(workflowActions[0].id)

  useEffect(() => {
    let active = true

    async function loadStages() {
      try {
        setLoadState('loading')
        setSourceLabel('Loading workflow stages.')

        const { rows: nextRows, source } = await fetchWorkflowStages()

        if (!active) {
          return
        }

        setRows(nextRows)
        setSourceLabel(source)
        setLoadState('ready')
      } catch (error) {
        if (!active) {
          return
        }

        setSourceLabel(
          error instanceof Error
            ? error.message
            : 'Dataverse did not return workflow stages.',
        )
        setLoadState('error')
      }
    }

    loadStages()

    return () => {
      active = false
    }
  }, [])

  const selectedAction =
    workflowActions.find((action) => action.id === selectedActionId) ??
    workflowActions[0]

  const stageViewModels = useMemo(
    () => buildStageViewModels(stages, selectedAction),
    [selectedAction, stages],
  )

  const currentStage = stages.find((stage) => stage.sequenceNumber === currentSequence)
  const destinationStage = stages.find(
    (stage) => stage.sequenceNumber === selectedAction.targetSequence,
  )
  const routeDirection =
    selectedAction.targetSequence > currentSequence ? 'forward' : 'backward'

  return (
    <main className="appShell">
      <section className="commandBar" aria-labelledby="workflow-title">
        <div className="workflowIntro">
          <p className="eyebrow">USGS model-driven app resource v2</p>
          <h1 id="workflow-title">{stages[0]?.workflowName ?? 'Workflow'}</h1>
          <p>
            {stages[0]?.workflowDescription ??
              'Workflow stages are loaded from Dataverse.'}
          </p>
          <p className="sourceNotice" aria-live="polite">
            {sourceLabel}
          </p>
        </div>

        <div className="actionPanel">
          <label htmlFor="workflow-action">Selected action</label>
          <select
            id="workflow-action"
            value={selectedActionId}
            onChange={(event) => setSelectedActionId(event.target.value)}
          >
            {workflowActions.map((action) => (
              <option key={action.id} value={action.id}>
                {action.label}
              </option>
            ))}
          </select>
          <p id="route-summary" aria-live="polite">
            {currentStage && destinationStage
              ? `${currentStage.stage} routes ${routeDirection} to ${destinationStage.stage}. ${selectedAction.helpText}`
              : 'Select an action after workflow stages load.'}
          </p>
        </div>
      </section>

      <section
        className="workflowCanvas"
        aria-labelledby="stepper-title"
        aria-describedby="route-summary"
      >
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Workflow stage table</p>
            <h2 id="stepper-title">Stage route preview</h2>
          </div>
          <div className="routeMeta" aria-label="Route details">
            <span>Current: {currentStage?.stage ?? 'Loading'}</span>
            <span>Destination: {destinationStage?.stage ?? 'Loading'}</span>
          </div>
        </div>

        {loadState === 'error' && (
          <div className="emptyState" role="alert">
            <h3>Unable to load workflow stages</h3>
            <p>{sourceLabel}</p>
          </div>
        )}

        {loadState !== 'error' && (
          <ol
            className="stepper"
            aria-busy={loadState === 'loading'}
            aria-label="Workflow stages"
          >
            {stageViewModels.map((stage) => (
              <li
                className="step"
                data-status={stage.status}
                key={stage.id}
                aria-current={stage.isDestination ? 'step' : undefined}
              >
                <div className="stepRail" aria-hidden="true"></div>
                <div className="stepMarker">
                  <StatusIcon status={stage.status} />
                </div>
                <div className="stepContent">
                  <div className="stageTitleRow">
                    <span className="stageNumber">
                      Stage {stage.sequenceNumber}
                    </span>
                    <span className="statusPill">
                      {statusContent[stage.status].label}
                    </span>
                  </div>
                  <h3>{stage.stage}</h3>
                  <p>{stage.description}</p>
                  <div className="stageTags" aria-label="Stage markers">
                    {stage.isCurrent && <span>Current location</span>}
                    {stage.isDestination && <span>Action destination</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="supportingGrid" aria-label="Implementation notes">
        <div className="legend" aria-label="Status legend">
          {Object.entries(statusContent).map(([status, content]) => (
            <div className="legendItem" data-status={status} key={status}>
              <StatusIcon status={status as StageStatus} />
              <span>{content.label}</span>
            </div>
          ))}
        </div>

        <details className="fetchPanel">
          <summary>FetchXML source</summary>
          <pre>{fetchXml}</pre>
        </details>
      </aside>
    </main>
  )
}

export default App