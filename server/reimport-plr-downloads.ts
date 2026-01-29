import { db } from './db';
import { plrs, plrDownloads, languages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getUncachableGoogleDriveClient, buildDirectFileUrl } from './drive-client';
import { logger } from './utils/logger';

const PLR_FOLDER_ID = "1itfq6kODRr77zVLF_xVHtdSsSwkkgUwR";

const LANGUAGE_MAP: Record<string, string> = {
  'portugues': 'pt-BR',
  'português': 'pt-BR',
  'pt': 'pt-BR',
  'pt-br': 'pt-BR',
  'ingles': 'en-US',
  'inglês': 'en-US',
  'en': 'en-US',
  'english': 'en-US',
  'espanhol': 'es-ES',
  'es': 'es-ES',
  'spanish': 'es-ES',
  'frances': 'fr-FR',
  'francês': 'fr-FR',
  'fr': 'fr-FR',
  'french': 'fr-FR',
  'alemao': 'de-DE',
  'alemão': 'de-DE',
  'de': 'de-DE',
  'german': 'de-DE',
  'italiano': 'it-IT',
  'it': 'it-IT',
  'italian': 'it-IT',
  'chines': 'zh-CN',
  'chinês': 'zh-CN',
  'zh': 'zh-CN',
  'chinese': 'zh-CN',
  'arabe': 'ar-SA',
  'árabe': 'ar-SA',
  'ar': 'ar-SA',
  'arabic': 'ar-SA',
  'hindi': 'hi-IN',
  'hi': 'hi-IN',
};

const FILE_TYPE_PATTERNS: Record<string, string[]> = {
  'ebook': ['.pdf', '.epub', '.mobi'],
  'vsl': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  'landingpage': ['.html', '.htm', '.zip'],
  'criativos': ['.psd', '.ai', '.png', '.jpg', '.jpeg', '.gif', '.zip'],
  'quiz': ['.json', '.zip'],
  'capa': ['capa.png', 'capa.jpg', 'capa.jpeg', 'cover.png', 'cover.jpg'],
};

async function getLanguageId(code: string): Promise<string | null> {
  const [lang] = await db.select().from(languages).where(eq(languages.code, code));
  return lang?.id || null;
}

async function reimportDownloads() {
  logger.info('\n🔄 ====================================================');
  logger.info('   REIMPORTAÇÃO DE DOWNLOADS DOS PLRs');
  logger.info('====================================================\n');

  try {
    const drive = await getUncachableGoogleDriveClient();
    logger.info('✅ Conectado ao Google Drive\n');

    const allPlrs = await db.select().from(plrs);
    logger.debug(`📚 ${allPlrs.length} PLRs encontrados no banco de dados\n`);

    const allLanguages = await db.select().from(languages);
    const languageMap = new Map(allLanguages.map(l => [l.code, l.id]));
    logger.debug(`🌍 ${allLanguages.length} idiomas disponíveis:`, allLanguages.map(l => l.code).join(', '), '\n');

    logger.debug(`📂 Listando pastas do Drive (${PLR_FOLDER_ID})...\n`);
    const plrFoldersResponse = await drive.files.list({
      q: `'${PLR_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    const plrFolders = plrFoldersResponse.data.files || [];
    logger.debug(`📁 ${plrFolders.length} pastas de PLR encontradas no Drive\n`);

    let totalDownloadsCreated = 0;
    let plrsProcessed = 0;
    let plrsSkipped = 0;

    for (const plr of allPlrs) {
      // Normalizar nome do PLR para comparação
      const plrNameNormalized = plr.title.toLowerCase().trim();
      
      // Procurar pasta correspondente no Drive
      const matchingFolder = plrFolders.find(folder => {
        const folderNameNormalized = folder.name?.toLowerCase().trim() || '';
        return folderNameNormalized === plrNameNormalized || 
               folderNameNormalized.includes(plrNameNormalized) ||
               plrNameNormalized.includes(folderNameNormalized);
      });

      if (!matchingFolder) {
        logger.warn(`⚠️  PLR "${plr.title}" - Pasta não encontrada no Drive`);
        plrsSkipped++;
        continue;
      }

      logger.debug(`\n📁 Processando: ${plr.title}`);
      logger.debug(`   Pasta Drive: ${matchingFolder.name} (${matchingFolder.id})`);

      // Listar conteúdo da pasta do PLR
      const plrContentsResponse = await drive.files.list({
        q: `'${matchingFolder.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });

      const plrContents = plrContentsResponse.data.files || [];
      let downloadsForThisPLR = 0;

      // Processar cada subpasta (idiomas)
      for (const item of plrContents) {
        if (item.mimeType !== 'application/vnd.google-apps.folder') continue;

        const folderName = item.name?.toLowerCase() || '';
        const languageCode = LANGUAGE_MAP[folderName];

        if (!languageCode) {
          // Pode ser uma pasta de tipo (ebook, vsl, etc) diretamente
          continue;
        }

        const languageId = languageMap.get(languageCode);
        if (!languageId) {
          logger.warn(`   ⚠️  Idioma ${languageCode} não encontrado no banco`);
          continue;
        }

        // Listar arquivos dentro da pasta do idioma
        const langFolderContents = await drive.files.list({
          q: `'${item.id}' in parents and trashed=false`,
          fields: 'files(id, name, mimeType)',
          pageSize: 100,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        const langFiles = langFolderContents.data.files || [];

        for (const file of langFiles) {
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            // É uma subpasta de tipo (ebook, vsl, etc)
            const typeName = file.name?.toLowerCase() || '';
            
            // Listar arquivos dentro da pasta de tipo
            const typeContents = await drive.files.list({
              q: `'${file.id}' in parents and trashed=false`,
              fields: 'files(id, name, mimeType)',
              pageSize: 100,
              supportsAllDrives: true,
              includeItemsFromAllDrives: true
            });

            const typeFiles = typeContents.data.files || [];

            for (const typeFile of typeFiles) {
              if (typeFile.mimeType === 'application/vnd.google-apps.folder') continue;

              const fileName = typeFile.name?.toLowerCase() || '';
              let downloadType = typeName;

              // Determinar tipo baseado no nome da pasta ou extensão
              if (typeName.includes('ebook') || fileName.endsWith('.pdf')) {
                downloadType = 'ebook';
              } else if (typeName.includes('vsl') || fileName.endsWith('.mp4')) {
                downloadType = 'vsl';
              } else if (typeName.includes('landing') || typeName.includes('pagina') || typeName.includes('página')) {
                downloadType = 'landingpage';
              } else if (typeName.includes('criativo')) {
                downloadType = 'criativos';
              } else if (typeName.includes('quiz')) {
                downloadType = 'quiz';
              }

              const fileUrl = buildDirectFileUrl(typeFile.id!);

              try {
                await db.insert(plrDownloads).values({
                  plrId: plr.id,
                  type: downloadType,
                  languageId: languageId,
                  fileUrl: fileUrl,
                });
                downloadsForThisPLR++;
                totalDownloadsCreated++;
                logger.debug(`   ✅ ${downloadType} (${languageCode}): ${typeFile.name}`);
              } catch (err: any) {
                if (err.code === '23505') {
                  logger.debug(`   ⏭️  ${downloadType} (${languageCode}) já existe`);
                } else {
                  logger.error(`   ❌ Erro ao criar download:`, err.message);
                }
              }
            }
          } else {
            // Arquivo direto na pasta do idioma
            const fileName = file.name?.toLowerCase() || '';
            let downloadType = 'ebook'; // default

            if (fileName.endsWith('.pdf') || fileName.endsWith('.epub')) {
              downloadType = 'ebook';
            } else if (fileName.endsWith('.mp4') || fileName.endsWith('.mov')) {
              downloadType = 'vsl';
            } else if (fileName.endsWith('.html') || fileName.endsWith('.zip')) {
              downloadType = 'landingpage';
            }

            const fileUrl = buildDirectFileUrl(file.id!);

            try {
              await db.insert(plrDownloads).values({
                plrId: plr.id,
                type: downloadType,
                languageId: languageId,
                fileUrl: fileUrl,
              });
              downloadsForThisPLR++;
              totalDownloadsCreated++;
              logger.debug(`   ✅ ${downloadType} (${languageCode}): ${file.name}`);
            } catch (err: any) {
              if (err.code === '23505') {
                logger.debug(`   ⏭️  ${downloadType} (${languageCode}) já existe`);
              } else {
                logger.error(`   ❌ Erro ao criar download:`, err.message);
              }
            }
          }
        }
      }

      if (downloadsForThisPLR > 0) {
        logger.debug(`   📊 ${downloadsForThisPLR} downloads criados para este PLR`);
        plrsProcessed++;
      } else {
        logger.warn(`   ⚠️  Nenhum download encontrado na estrutura`);
        plrsSkipped++;
      }
    }

    logger.info('\n====================================================');
    logger.info('📊 RESUMO DA REIMPORTAÇÃO');
    logger.info('====================================================');
    logger.info(`✅ PLRs processados: ${plrsProcessed}`);
    logger.info(`⚠️  PLRs ignorados: ${plrsSkipped}`);
    logger.info(`📥 Total de downloads criados: ${totalDownloadsCreated}`);
    logger.info('====================================================\n');

  } catch (error) {
    logger.error('❌ Erro na reimportação:', error);
    throw error;
  }
}

reimportDownloads()
  .then(() => {
    logger.info('✅ Reimportação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Falha na reimportação:', error);
    process.exit(1);
  });
