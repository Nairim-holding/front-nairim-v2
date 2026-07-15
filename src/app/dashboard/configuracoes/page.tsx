'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, DatabaseBackup, Loader2, ShieldAlert, Upload, AlertTriangle, History } from 'lucide-react';
import Section from '@/components/layout/PageSection';
import { useAuth } from '@/contexts/AuthContext';
import { useMessageContext } from '@/contexts/MessageContext';
import { authFetch } from '@/utils/authFetch';

const API_URL = process.env.NEXT_PUBLIC_URL_API ?? '';

const isAdminRole = (role?: string) =>
  !!role && role.toLowerCase().includes('admin');

interface AutoBackup {
  name: string;
  size: number;
  createdAt: string;
}

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { showMessage } = useMessageContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [generating, setGenerating] = useState(false);

  // Restore state
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmationName, setConfirmationName] = useState('');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Auto-backups (gerados antes de cada restore)
  const [autoBackups, setAutoBackups] = useState<AutoBackup[]>([]);

  const isAdmin = isAdminRole(user?.role);

  // Confirmação do restore: aceita o slug OU o nome da empresa (case-insensitive).
  const confirmationValid =
    !!confirmationName &&
    (confirmationName.toLowerCase() === user?.company_slug?.toLowerCase() ||
      confirmationName.toLowerCase() === user?.name?.toLowerCase());

  const loadAutoBackups = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await authFetch(`${API_URL}/backup/auto`);
      if (!res.ok) return;
      const j = await res.json().catch(() => ({}));
      setAutoBackups(Array.isArray(j.data) ? j.data : []);
    } catch {
      /* silencioso: lista opcional */
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAutoBackups();
  }, [loadAutoBackups]);

  const handleDownloadAutoBackup = async (name: string) => {
    try {
      const res = await authFetch(`${API_URL}/backup/auto/${encodeURIComponent(name)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Erro ao baixar o backup automático.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showMessage(e?.message ?? 'Erro ao baixar o backup automático.', 'error');
    }
  };

  const handleBackup = async () => {
    setGenerating(true);
    try {
      const res = await authFetch(`${API_URL}/backup/export`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Erro ao gerar o backup.');
      }

      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `backup-nairim-${new Date().toISOString().slice(0, 10)}.json`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showMessage('Backup gerado. O download foi iniciado.', 'success');
    } catch (e: any) {
      showMessage(e?.message ?? 'Erro ao gerar o backup.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showMessage('Por favor, selecione um arquivo .json', 'error');
      return;
    }

    setSelectedFile(file);
    setConfirmationName('');
  };

  const handleRestore = async () => {
    if (!selectedFile || !confirmationName) {
      showMessage('Arquivo e confirmação são obrigatórios', 'error');
      return;
    }

    // Aceita tanto o nome quanto o slug da empresa (case-insensitive)
    const isValidConfirmation =
      confirmationName.toLowerCase() === user?.company_slug?.toLowerCase() ||
      confirmationName.toLowerCase() === user?.name?.toLowerCase();

    if (!isValidConfirmation) {
      showMessage(`Confirmação inválida. Digite exatamente: "${user?.company_slug}" ou "${user?.name}"`, 'error');
      return;
    }

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('confirmationName', confirmationName);

      // Usar authFetch com FormData (não define Content-Type, deixa navegador fazer)
      const res = await authFetch(`${API_URL}/backup/restore`, {
        method: 'POST',
        body: formData,
        headers: {
          // NÃO definir Content-Type: multipart/form-data — deixa o navegador fazer
          // Remover qualquer Content-Type que authFetch possa ter adicionado
        },
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(j.message || 'Erro ao restaurar backup');
      }

      showMessage('✅ Restauração concluída com sucesso! Recarregando...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      showMessage(e?.message ?? 'Erro ao restaurar backup.', 'error');
    } finally {
      setRestoring(false);
      setShowRestoreConfirm(false);
    }
  };

  return (
    <Section title="Configurações">
      <div className="max-w-2xl space-y-6">
        {/* Backup */}
        <div className="bg-surface border border-ui-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <DatabaseBackup size={22} />
            </div>
            <h2 className="text-lg font-semibold text-content">Gerar Backup</h2>
          </div>
          <p className="text-[13px] text-content-secondary mb-4">
            Gere uma cópia dos dados da sua empresa. O arquivo inclui imóveis, locações,
            financeiro, cadastros; arquivos de mídia são referenciados por link.
          </p>

          {isAdmin ? (
            <button
              onClick={handleBackup}
              disabled={generating}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {generating ? 'Gerando backup...' : 'Gerar e baixar backup'}
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-ui-border-soft bg-surface-subtle px-3 py-2 text-[13px] text-content-secondary">
              <ShieldAlert size={16} className="text-content-muted flex-shrink-0" />
              Apenas administradores podem gerar backups.
            </div>
          )}
        </div>

        {/* Restauração */}
        {isAdmin && (
          <div className="bg-surface border border-ui-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-orange-100/50">
                <Upload size={22} className="text-orange-600" />
              </div>
              <h2 className="text-lg font-semibold text-content">Restaurar de Backup</h2>
            </div>
            <p className="text-[13px] text-content-secondary mb-4">
              ⚠️ Restaurar um backup substituirá TODOS os dados atuais. Um backup automático
              será criado antes de qualquer restauração.
            </p>

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-ui-border rounded-lg p-6 text-center cursor-pointer hover:bg-surface-subtle transition-colors"
              >
                <Upload size={24} className="mx-auto mb-2 text-content-muted" />
                <p className="text-sm font-medium text-content">Clique para selecionar o arquivo</p>
                <p className="text-xs text-content-muted">ou arraste aqui</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-content">{selectedFile.name}</p>
                      <p className="text-xs text-content-secondary">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setConfirmationName('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Remover
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-content block mb-1">
                    Confirmação: Digite o nome da sua empresa
                  </label>
                  <input
                    type="text"
                    placeholder={user?.company_slug || 'Nome da empresa'}
                    value={confirmationName}
                    onChange={e => setConfirmationName(e.target.value)}
                    className="w-full px-3 py-2 border border-ui-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                  <p className="text-xs text-content-muted mt-1">
                    Aceita: <strong>{user?.company_slug}</strong> ou <strong>{user?.name}</strong>
                  </p>
                </div>

                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  disabled={restoring || !confirmationValid}
                  className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {restoring ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                  {restoring ? 'Restaurando...' : 'Restaurar agora'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Backups automáticos (gerados antes de cada restore) */}
        {isAdmin && autoBackups.length > 0 && (
          <div className="bg-surface border border-ui-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-brand/10 text-brand">
                <History size={22} />
              </div>
              <h2 className="text-lg font-semibold text-content">Backups automáticos</h2>
            </div>
            <p className="text-[13px] text-content-secondary mb-4">
              Cópias do estado da empresa geradas automaticamente <strong>antes</strong> de
              cada restauração. Use para reverter caso algo dê errado.
            </p>

            <ul className="divide-y divide-ui-border-soft">
              {autoBackups.map((b) => (
                <li key={b.name} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-content truncate">{b.name}</p>
                    <p className="text-xs text-content-muted">
                      {new Date(b.createdAt).toLocaleString('pt-BR')} · {(b.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadAutoBackup(b.name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand border border-ui-border rounded-lg hover:bg-surface-subtle transition-colors flex-shrink-0"
                  >
                    <Download size={14} />
                    Baixar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Modal de confirmação */}
        {showRestoreConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-surface rounded-xl shadow-xl max-w-md p-6 mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-100/50">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-content">Confirmar restauração</h3>
              </div>

              <p className="text-sm text-content-secondary mb-4">
                Você está prestes a restaurar um backup. Todos os dados atuais serão <strong>permanentemente substituídos</strong>.
                Um backup automático será criado para segurança.
              </p>

              <p className="text-sm font-medium text-red-600 mb-4 p-3 bg-red-50 rounded-lg">
                ⚠️ Esta ação não pode ser desfeita sem restaurar o backup automático.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  disabled={restoring}
                  className="flex-1 px-4 py-2 border border-ui-border rounded-lg text-sm font-medium hover:bg-surface-subtle disabled:opacity-60 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {restoring ? <Loader2 size={14} className="animate-spin" /> : null}
                  {restoring ? 'Restaurando...' : 'Restaurar agora'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
