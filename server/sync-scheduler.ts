import cron from 'node-cron';
import { listFolderContents } from './google-drive';
import { sendEmail, generateSyncReportTemplate } from './email';
import { storage } from './storage';
import { logger } from './utils/logger';

const PLUGINS_FOLDER_ID = "1jccFmyPPJROl1UAEiWUaeTHaDeFxeXZc";
const TEMPLATES_FOLDER_ID = "1a3bztWWiTVUmi0-I9RqeJXsqy-CIzR2k";
const NOTIFICATION_EMAIL = "jl.uli1996@gmail.com";

const COURSE_FOLDERS = [
  { name: "Low Ticket", folderId: "1HzZPswxdmN95zVEFQmgUjCJ77F44oPiD" },
  { name: "Afiliados", folderId: "14KmqdoXqiF6WPS1gaxiC_dPvfuii6Oyi" },
  { name: "Mentorias e Formações", folderId: "1zyqb4KU_fZKHGMBBeMCpl_FGik-ufYNY" },
  { name: "Conteúdos dos Membros", folderId: "1CzBn4a48p78S3Zp_PaWv2Ffdkncq0UFp" },
  { name: "Desenvolvimento Pessoal", folderId: "1aoAHZtrL0hiNXrIdfr1Z-Lc8-O8bN_cQ" },
  { name: "Inteligência Artificial", folderId: "1C3C5kC5G23NvjxpQ2Ofivu-Kbf6dfWdy" },
  { name: "iGaming", folderId: "1cadfdm0pHMDQsx_qpI8obl6xDukAtvgd" },
  { name: "YouTube", folderId: "1zlRxvJRhYByqimhQck5BwaTjQYbFYj6l" },
  { name: "TikTok", folderId: "1IadBzjLqzGISpu9gVA8edeBD9mVz5wWp" },
];

export async function syncDriveContent(): Promise<{
  success: boolean;
  pluginsCount: number;
  coursesCount: number;
  templatesCount: number;
  error?: string;
}> {
  try {
    logger.debug('\n🔄 [SYNC] Iniciando sincronização semanal...');
    logger.debug('📅 Data/Hora:', new Date().toLocaleString('pt-BR'));

    let pluginsCount = 0;
    let coursesCount = 0;
    let templatesCount = 0;

    logger.debug('\n📦 [SYNC] Atualizando cache de Plugins...');
    try {
      const pluginsFiles = await listFolderContents(PLUGINS_FOLDER_ID);
      pluginsCount = pluginsFiles.length;
      logger.debug(`✅ [SYNC] Plugins: ${pluginsCount} arquivos encontrados`);

      // Listar os primeiros arquivos para confirmar
      if (pluginsFiles.length > 0) {
        logger.debug(`  📁 Exemplos de plugins:`);
        pluginsFiles.slice(0, 5).forEach(file => {
          logger.debug(`    - ${file.name}`);
        });
      }
    } catch (error) {
      logger.error('❌ [SYNC] Erro ao sincronizar Plugins:', error);
    }

    logger.debug('\n📄 [SYNC] Atualizando cache de Páginas e Templates...');
    try {
      const templatesFiles = await listFolderContents(TEMPLATES_FOLDER_ID);
      templatesCount = templatesFiles.length;
      logger.debug(`✅ [SYNC] Templates: ${templatesCount} arquivos encontrados`);
    } catch (error) {
      logger.error('❌ [SYNC] Erro ao sincronizar Templates:', error);
    }

    logger.debug('\n📚 [SYNC] Sincronizando Cursos do Drive para o Banco...');

    // Obter todos os cursos existentes
    const existingCourses = await storage.getCourses();
    const existingCoursesMap = new Map(
      existingCourses
        .filter(c => c.driveFolderId)
        .map(c => [c.driveFolderId!, c])
    );

    let createdCount = 0;
    let updatedCount = 0;

    for (const courseFolder of COURSE_FOLDERS) {
      try {
        const files = await listFolderContents(courseFolder.folderId);
        logger.debug(`📂 [SYNC] ${courseFolder.name}: ${files.length} arquivos encontrados`);

        for (const file of files) {
          const courseData = {
            title: file.name || 'Sem título',
            category: courseFolder.name,
            driveFolderId: file.id,
            driveFolderUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
            sourceType: 'drive' as const,
            isActive: true,
            description: `Curso da categoria: ${courseFolder.name}`,
          };

          // Verificar se já existe
          const existingCourse = existingCoursesMap.get(file.id);

          if (existingCourse) {
            // Atualizar curso existente
            await storage.updateCourse(existingCourse.id, courseData);
            updatedCount++;
            logger.debug(`  🔄 Atualizado: ${file.name}`);
          } else {
            // Criar novo curso
            const newCourse = await storage.createCourse(courseData);
            createdCount++;
            // Adicionar ao Map para evitar duplicação na mesma execução
            existingCoursesMap.set(file.id, newCourse);
            logger.debug(`  ✅ Adicionado: ${file.name}`);
          }
        }
      } catch (error) {
        logger.error(`❌ [SYNC] Erro ao sincronizar ${courseFolder.name}:`, error);
      }
    }

    coursesCount = createdCount + updatedCount;
    logger.debug(`📊 [SYNC] Total: ${createdCount} novos, ${updatedCount} atualizados`);

    logger.debug('\n════════════════════════════════════════════════════════');
    logger.debug('✅ [SYNC] Sincronização semanal concluída!');
    logger.debug(`   📦 Plugins: ${pluginsCount} arquivos`);
    logger.debug(`   📄 Templates: ${templatesCount} arquivos`);
    logger.debug(`   📚 Cursos: ${coursesCount} arquivos`);
    logger.debug('════════════════════════════════════════════════════════\n');

    const result = {
      success: true,
      pluginsCount,
      coursesCount,
      templatesCount
    };

    // Enviar email de notificação
    try {
      const syncDate = new Date();
      const emailHtml = generateSyncReportTemplate(result, syncDate);
      await sendEmail({
        to: NOTIFICATION_EMAIL,
        subject: `✅ Sincronização Realizada - ${syncDate.toLocaleDateString('pt-BR')}`,
        html: emailHtml
      });
      logger.debug('📧 [SYNC] Email de notificação enviado com sucesso!');
    } catch (emailError) {
      logger.error('❌ [SYNC] Erro ao enviar email de notificação:', emailError);
    }

    return result;
  } catch (error) {
    logger.error('❌ [SYNC] Erro crítico na sincronização:', error);
    const result = {
      success: false,
      pluginsCount: 0,
      coursesCount: 0,
      templatesCount: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };

    // Enviar email de notificação de erro
    try {
      const syncDate = new Date();
      const emailHtml = generateSyncReportTemplate(result, syncDate);
      await sendEmail({
        to: NOTIFICATION_EMAIL,
        subject: `❌ Erro na Sincronização - ${syncDate.toLocaleDateString('pt-BR')}`,
        html: emailHtml
      });
      logger.debug('📧 [SYNC] Email de erro enviado com sucesso!');
    } catch (emailError) {
      logger.error('❌ [SYNC] Erro ao enviar email de erro:', emailError);
    }

    return result;
  }
}

export function startWeeklySync() {
  logger.debug('🤖 Agendador de sincronização semanal iniciado!');
  logger.debug('📅 Sincronização programada: Toda segunda-feira às 03:00 da manhã');
  logger.debug('📦 Escopo: Plugins, Templates e Cursos\n');

  cron.schedule('0 3 * * 1', async () => {
    logger.debug('\n⏰ Executando sincronização semanal agendada...');
    await syncDriveContent();
  }, {
    timezone: "America/Sao_Paulo"
  });

  logger.debug('✅ Agendador ativo e funcionando!\n');
}