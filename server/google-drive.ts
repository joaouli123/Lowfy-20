import { google } from 'googleapis';
import { logger } from './utils/logger';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  const user = await storage.getAdminUser();
  if (!user) {
    throw new Error('Admin user not found');
  }

  const settings = user.settings as GoogleDriveSettings | undefined;
  if (!settings?.google_drive_refresh_token) {
    throw new Error('Google Drive não configurado. Configure o Google Drive nas configurações de administrador.');
  }

  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
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

  try {
    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);
  } catch (error) {
    logger.error('Error fetching connection settings:', error);
    // Fallback to using the refresh token directly if fetching fails
    // This assumes the refresh token is still valid and can be used to get an access token.
    // A more robust solution would involve a token exchange flow.
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ refresh_token: settings.google_drive_refresh_token });
    const tokens = await oauth2Client.refreshAccessToken();
    const accessToken = tokens.credentials.access_token;

    if (!accessToken) {
      throw new Error('Failed to refresh Google Drive access token.');
    }
    return accessToken;
  }

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleDriveClient() {
  try {
    const accessToken = await getAccessToken();

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    logger.error('Error creating Google Drive client:', error);
    // Return null or throw a specific error to indicate the client could not be created
    // This allows the caller to handle the case where the Drive is unavailable.
    return null;
  }
}

export async function listDriveFolders() {
  try {
    const drive = await getUncachableGoogleDriveClient();
    if (!drive) {
      return []; // Return empty array if Drive client cannot be created
    }

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
    });

    return response.data.files || [];
  } catch (error) {
    logger.error('Error listing Google Drive folders:', error);
    throw error;
  }
}

export async function getFolderById(folderId: string) {
  try {
    const drive = await getUncachableGoogleDriveClient();
    if (!drive) {
      throw new Error('Google Drive client not available.');
    }

    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, webViewLink, createdTime, modifiedTime',
    });

    return response.data;
  } catch (error) {
    logger.error('Error getting Google Drive folder:', error);
    throw error;
  }
}

export async function listFolderContents(folderId: string) {
  try {
    const drive = await getUncachableGoogleDriveClient();
    if (!drive) {
      throw new Error('Google Drive client not available.');
    }
    let allFiles: any[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;

    // Loop para buscar todas as páginas de resultados
    do {
      pageCount++;
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink, size, createdTime, modifiedTime)',
        orderBy: 'folder,name',
        pageSize: 1000, // Aumentado para 1000 (máximo permitido pela API do Google)
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const filesInPage = response.data.files?.length || 0;
      allFiles = allFiles.concat(response.data.files || []);

      logger.debug(`  📄 Página ${pageCount}: ${filesInPage} arquivos (Total: ${allFiles.length})`);

      pageToken = response.data.nextPageToken || undefined;

      if (pageToken) {
        logger.debug(`  ➡️ Há mais arquivos, buscando próxima página...`);
      }
    } while (pageToken);

    logger.debug(`  ✅ Concluído: ${allFiles.length} arquivos em ${pageCount} página(s)`);
    return allFiles;
  } catch (error) {
    logger.error('Error listing folder contents:', error);
    throw error;
  }
}

// Placeholder for storage and GoogleDriveSettings if they are not defined elsewhere in the original code
// In a real scenario, these would be imported or defined.
const storage = {
  getAdminUser: async () => {
    // Mock implementation: replace with actual storage logic
    // For demonstration, returning a user with a placeholder refresh token
    return {
      settings: {
        google_drive_refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || 'mock_refresh_token'
      }
    };
  }
};

interface GoogleDriveSettings {
  google_drive_refresh_token?: string;
}