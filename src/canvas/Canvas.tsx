import {
  Background,
  Controls,
  ReactFlow,
  useNodesState,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo } from 'react'
import { derive } from '../model/derive'
import { useStore } from '../state/store'
import { DecisionNodeView } from './DecisionNode'

const nodeTypes = { decision: DecisionNodeView }

export function Canvas() {
  const root = useStore((s) => s.project.root)
  const select = useStore((s) => s.select)
  const setPos = useStore((s) => s.setPos)

  const derived = useMemo(() => derive(root), [root])

  // React Flow owns drag in flight; the tree owns the resting position (persisted via `pos`).
  const [nodes, setNodes, onNodesChange] = useNodesState(derived.nodes)
  useEffect(() => setNodes(derived.nodes), [derived, setNodes])

  const onNodeClick: NodeMouseHandler = (_, node) => select(node.id)

  return (
    <ReactFlow
      nodes={nodes}
      edges={derived.edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
      onNodeDragStop={(_, node) => setPos(node.id, { x: node.position.x, y: node.position.y })}
      onPaneClick={() => select(null)}
      fitView
      minZoom={0.15}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
    >
      <Background gap={24} color="#1c1c22" />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
