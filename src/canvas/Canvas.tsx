import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo } from 'react'
import { derive } from '../model/derive'
import { useStore } from '../state/store'
import { DecisionNodeView } from './DecisionNode'

const nodeTypes = { decision: DecisionNodeView }

export function Canvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  )
}

function Flow() {
  const project = useStore((s) => s.project)
  const hydrated = useStore((s) => s.hydrated)
  const select = useStore((s) => s.select)
  const setSheet = useStore((s) => s.setSheet)
  const sheetOpen = useStore((s) => s.sheetOpen)
  const setPos = useStore((s) => s.setPos)
  const focusRequest = useStore((s) => s.focusRequest)
  const clearFocus = useStore((s) => s.clearFocus)

  const derived = useMemo(() => derive(project), [project])

  // React Flow owns drag in flight; the tree owns the resting position (persisted via `pos`).
  const [nodes, setNodes, onNodesChange] = useNodesState(derived.nodes)
  useEffect(() => setNodes(derived.nodes), [derived, setNodes])

  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const count = derived.nodes.length

  // Growing the tree should stay on screen without a manual pan. fitView is a no-op until every
  // node has measured dimensions, so gate on that rather than on a timer.
  // `shortcut: refit on node-count or hydration change only; a rename does not reframe the view.`
  useEffect(() => {
    if (!nodesInitialized) return
    // `sheetOpen` changes the canvas height on a phone — refit so nothing hides behind the sheet.
    // v13 takes padding in pixels; a fraction is read as ~0 and the graph overflows the viewport.
    // On a phone, fitting the whole tree makes every card unreadable. Keep a floor on the zoom
    // and let the user pan, rather than shrinking to a postage stamp.
    const compact = window.innerWidth < 768
    const timer = setTimeout(
      () =>
        fitView({
          padding: compact ? 30 : 60,
          minZoom: compact ? 0.7 : 0.1,
          duration: 200,
        }),
      40,
    )
    return () => clearTimeout(timer)
  }, [count, hydrated, nodesInitialized, sheetOpen, fitView])

  // A finder hit or outline click asks the canvas to centre that node.
  useEffect(() => {
    if (!focusRequest) return
    const timer = setTimeout(() => {
      fitView({ nodes: [{ id: focusRequest }], duration: 350, maxZoom: 1.2, padding: 120 })
      clearFocus()
    }, 60)
    return () => clearTimeout(timer)
  }, [focusRequest, fitView, clearFocus])

  const onNodeClick: NodeMouseHandler = (_, node) => {
    select(node.id)
    setSheet(true)
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={derived.edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
      onNodeDragStop={(_, node) => setPos(node.id, { x: node.position.x, y: node.position.y })}
      onPaneClick={() => select(null)}
      fitViewOptions={{ padding: 60 }}
      minZoom={0.15}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
    >
      <Background gap={28} color="#15171b" />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
