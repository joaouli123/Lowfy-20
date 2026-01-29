import { google } from 'googleapis';
import { logger } from './utils/logger';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME environment variable not found');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  connectionSettings = data.items?.[0];

  if (!connectionSettings) {
    throw new Error('Google Drive integration not found. Please connect Google Drive in the Replit integrations panel.');
  }

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!accessToken) {
    throw new Error('Google Drive access token not found in connection settings');
  }
  
  return accessToken;
}

export async function getUncachableGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  path: string;
}

export async function listFilesInFolder(
  folderId: string, 
  onFile?: (file: DriveFile) => void | Promise<void>,
  ignoreFolders: string[] = []
): Promise<DriveFile[]> {
  const drive = await getUncachableGoogleDriveClient();
  const allFiles: DriveFile[] = [];
  
  async function listRecursively(parentId: string, currentPath: string = '') {
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    
    do {
      pageCount++;
      logger.debug(`  📄 Carregando página ${pageCount} da pasta: ${currentPath || 'raiz'}`);
      
      const response = await drive.files.list({
        q: `'${parentId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, parents)',
        pageToken: pageToken,
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      const files = response.data.files || [];
      logger.debug(`  ✅ ${files.length} arquivos encontrados nesta página`);
      
      for (const file of files) {
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name!;
        
        if (file.mimeType === 'application/vnd.google-apps.folder' && ignoreFolders.includes(file.name!)) {
          logger.debug(`  ⏭️  Pasta ignorada: ${file.name}`);
          continue;
        }
        
        const driveFile: DriveFile = {
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          parents: file.parents,
          path: filePath
        };
        
        allFiles.push(driveFile);
        
        if (onFile) {
          await onFile(driveFile);
        }

        if (file.mimeType === 'application/vnd.google-apps.folder') {
          await listRecursively(file.id!, filePath);
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  }

  await listRecursively(folderId);
  return allFiles;
}

export function buildDirectFileUrl(fileId: string): string {
  // Formato direto para visualização de imagens
  // IMPORTANTE: O arquivo deve estar compartilhado publicamente (Anyone with the link)
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function buildThumbnailUrl(fileId: string, size: number = 800): string {
  // Formato de thumbnail que funciona melhor para imagens
  // Tamanhos comuns: 200, 400, 800, 1600
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

export function buildFileViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
