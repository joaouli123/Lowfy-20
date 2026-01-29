export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <h1 style={{ 
          fontSize: '120px', 
          fontWeight: 'bold', 
          margin: '0',
          color: '#333',
          lineHeight: '1'
        }}>
          404
        </h1>
        <h2 style={{ 
          fontSize: '36px', 
          color: '#333', 
          marginTop: '30px',
          marginBottom: '10px',
          fontWeight: '600'
        }}>
          Página Não Encontrada
        </h2>
        <p style={{ 
          fontSize: '16px', 
          color: '#666', 
          marginTop: '15px', 
          marginBottom: '30px',
          maxWidth: '500px',
          lineHeight: '1.6'
        }}>
          Desculpe, a página que você está procurando não existe ou foi removida.
        </p>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '500',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.3s'
            }}
            onMouseOver={(e) => (e.currentTarget as any).style.backgroundColor = '#45a049'}
            onMouseOut={(e) => (e.currentTarget as any).style.backgroundColor = '#4CAF50'}
          >
            Ir para Timeline
          </button>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '500',
              backgroundColor: '#f0f0f0',
              color: '#333',
              border: '2px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseOver={(e) => {
              (e.currentTarget as any).style.backgroundColor = '#e0e0e0';
              (e.currentTarget as any).style.borderColor = '#999';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as any).style.backgroundColor = '#f0f0f0';
              (e.currentTarget as any).style.borderColor = '#ddd';
            }}
          >
            Voltar
          </button>
        </div>

        <p style={{ 
          fontSize: '13px', 
          color: '#999', 
          marginTop: '40px',
          paddingTop: '30px',
          borderTop: '1px solid #ddd'
        }}>
          Se acredita que isso é um erro, entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}
