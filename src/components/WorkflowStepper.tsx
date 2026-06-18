import React from 'react';
import { useAppContext } from '../context/AppContext';


export const WorkflowStepper: React.FC = () => {
  const { connectionStatus, extractionStatus, result } = useAppContext();

  const isBridgeDone = connectionStatus === 'connected';
  const isExtractDone = extractionStatus === 'done';
  const isAnalyseDone = !!result;

  const steps = [
    {
      id: 'bridge',
      label: 'Bridge',
      desc: 'Hardware Serial Connection',
      isActive: connectionStatus !== 'connected',
      isCompleted: isBridgeDone,
    },
    {
      id: 'extract',
      label: 'Extract',
      desc: 'Flash ROM Extraction',
      isActive: connectionStatus === 'connected' && extractionStatus !== 'done',
      isCompleted: isExtractDone,
    },
    {
      id: 'analyse',
      label: 'Analyse',
      desc: 'Ghidra Decompilation',
      isActive: extractionStatus === 'done' && !result,
      isCompleted: isAnalyseDone,
    },
    {
      id: 'explore',
      label: 'Explore',
      desc: 'Interactive Decompiler Explorer',
      isActive: !!result,
      isCompleted: false, // Remains interactive / target
    },
  ];

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between w-full p-2 rounded-lg gap-2 bg-[#111111]" style={{ border: '1px solid var(--border-subtle)' }}>
      {steps.map((step, idx) => {
        const status = step.isCompleted ? 'completed' : step.isActive ? 'active' : 'pending';

        return (
          <React.Fragment key={step.id}>
            <div className="flex-1 flex items-center px-4 py-2 rounded-md select-none transition-all duration-200"
              style={{
                backgroundColor: status === 'completed' ? 'var(--bg-elevated)' : 'transparent',
                borderLeft: status === 'active' ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-200"
                  style={{
                    backgroundColor: status === 'completed' ? 'var(--accent)' : 'transparent',
                    color: status === 'completed' ? 'var(--bg-base)' : status === 'active' ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: status === 'completed' ? 'none' : `1px solid ${status === 'active' ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                  }}
                >
                  {step.isCompleted ? '✓' : idx + 1}
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-[12px] font-medium transition-colors"
                    style={{
                      color: status === 'completed' || status === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {step.label}
                  </span>
                  <span
                    className="text-[10px] font-normal transition-colors"
                    style={{
                      color: status === 'completed' || status === 'active' ? 'var(--text-secondary)' : 'var(--text-muted)',
                    }}
                  >
                    {step.desc}
                  </span>
                </div>
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div
                className="hidden md:block w-4 h-[1px]"
                style={{ backgroundColor: 'var(--border-subtle)' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default WorkflowStepper;
