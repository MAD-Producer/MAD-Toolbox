import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Download,
  XCircle
} from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import type {
  DiagnosticExportResult,
  JobLog,
  JobState,
  LogExportRequest
} from "../lib/types";

interface TasksPageProps {
  jobs: JobState[];
  logs: JobLog[];
  onCancel: (jobId: string) => void;
  onExport: (request: LogExportRequest) => Promise<DiagnosticExportResult>;
}

export function TasksPage({ jobs, logs, onCancel, onExport }: TasksPageProps) {
  const [exportingJob, setExportingJob] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const exportLog = async (job: JobState) => {
    const chosenPath = await save({
      defaultPath: `MAD-Toolbox-${job.tool}-${job.jobId.slice(0, 8)}.log`,
      filters: [{ name: "任务日志", extensions: ["log", "txt"] }]
    });
    if (!chosenPath) return;
    const outputPath = /\.(log|txt)$/i.test(chosenPath) ? chosenPath : `${chosenPath}.log`;
    setExportingJob(job.jobId);
    setNotice(null);
    try {
      const result = await onExport({
        job,
        logs: logs.filter((log) => log.jobId === job.jobId),
        outputPath
      });
      setNotice(`日志已导出：${result.path}`);
    } catch (error) {
      setNotice(`日志导出失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExportingJob(null);
    }
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">JOB QUEUE</span>
          <h1>任务中心</h1>
          <p>查看任务状态、取消后台任务，或导出单个任务的日志文件。</p>
        </div>
      </div>
      {notice && <div className="notice info"><span>{notice}</span></div>}
      <div className="task-list">
        {jobs.length === 0 ? (
          <div className="empty-state">还没有执行过任务。</div>
        ) : (
          jobs.map((job) => (
            <div className="task-row" key={job.jobId}>
              <span className={`task-state ${job.state}`}>
                {job.state === "running" ? (
                  <CircleDashed size={18} className="spin" />
                ) : job.state === "completed" ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <XCircle size={18} />
                )}
              </span>
              <span className="task-copy">
                <strong>{job.tool}</strong>
                <small>{job.message}</small>
              </span>
              <code>{job.jobId.slice(0, 8)}</code>
              <span className="task-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={exportingJob === job.jobId}
                  onClick={() => void exportLog(job)}
                >
                  <Download size={14} />
                  {exportingJob === job.jobId ? "导出中" : "导出日志"}
                </button>
                {job.state === "running" && (
                  <button className="danger-button" type="button" onClick={() => onCancel(job.jobId)}>
                    <Ban size={14} />
                    取消
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
