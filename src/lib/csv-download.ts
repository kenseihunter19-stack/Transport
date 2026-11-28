import { apiUrl } from "@/lib/runtime-config";

export async function downloadServerCsv(params: {
  path: string;
  filename: string;
  query?: {
    from?: string;
    to?: string;
    schoolId?: number | string | null;
  };
  getAuthToken: () => Promise<string | null>;
}): Promise<void> {
  const { path, filename, query, getAuthToken } = params;
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Sessão expirada. Inicie sessão novamente para exportar o relatório.");
  }

  const search = new URLSearchParams();
  if (query?.from && query.from.trim()) search.set("from", query.from.trim());
  if (query?.to && query.to.trim()) search.set("to", query.to.trim());
  if (query?.schoolId !== undefined && query.schoolId !== null && String(query.schoolId).trim() !== "") {
    search.set("schoolId", String(query.schoolId).trim());
  }

  const qs = search.toString();
  const urlPath = qs ? `${path}?${qs}` : path;

  const res = await fetch(apiUrl(urlPath), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let message = `Falha ao exportar relatório (HTTP ${res.status}).`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = String(errBody.error);
    } catch {
      // ignore non-JSON body
    }
    throw new Error(message);
  }

  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  const resolvedFilename = match?.[1] || filename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = resolvedFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
