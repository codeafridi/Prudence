import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import { derive } from '../model/derive'
import { useStore } from '../state/store'
import { DecisionNodeView } from './DecisionNode'

const nodeTypes = { decision: DecisionNodeView }

export function Canvas() {
  const root = useStore((s) => s.project.root)
  const { nodes, edges } = useMemo(() => derive(root), [root])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
    >
      <Background gap={24} color="#1c1c22" />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}
