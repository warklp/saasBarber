// Script para aplicar migrações ao banco de dados
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Diretório de migrações
const migrationsDir = path.join(__dirname, '../migrations');

// Função para aplicar uma migração
async function applyMigration(filePath) {
  try {
    const fileName = path.basename(filePath);
    console.log(`Aplicando migração: ${fileName}`);
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error(`Erro ao aplicar migração ${fileName}:`, error);
      return false;
    }
    
    console.log(`Migração ${fileName} aplicada com sucesso!`);
    return true;
  } catch (error) {
    console.error(`Erro ao processar migração:`, error);
    return false;
  }
}

// Função principal
async function runMigrations() {
  try {
    console.log('Iniciando aplicação de migrações...');
    
    // Verificar se o diretório de migrações existe
    if (!fs.existsSync(migrationsDir)) {
      console.error(`Diretório de migrações não encontrado: ${migrationsDir}`);
      process.exit(1);
    }
    
    // Ler arquivos de migração
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ordenar arquivos por nome
    
    if (files.length === 0) {
      console.log('Nenhuma migração encontrada.');
      process.exit(0);
    }
    
    console.log(`Encontradas ${files.length} migrações.`);
    
    // Aplicar migrações em sequência
    let successCount = 0;
    let failCount = 0;
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const success = await applyMigration(filePath);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    console.log('=== Resumo das Migrações ===');
    console.log(`Total: ${files.length}`);
    console.log(`Sucesso: ${successCount}`);
    console.log(`Falha: ${failCount}`);
    
    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Erro ao executar migrações:', error);
    process.exit(1);
  }
}

// Executar o script
runMigrations(); 