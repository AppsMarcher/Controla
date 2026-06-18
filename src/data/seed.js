/* Sementes para o modo localStorage (no Supabase, use sql/seed_ramais.sql). */
export const RAMAIS_SEED_VERSION = 4;

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

export function seedRamais() {
  return [
    { id: uid(), setor: 'Engenharia P&D', ramal: '5555', responsavel: 'Alcyr Roberto Machado', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Compras', ramal: '5563', responsavel: 'Alessandra Mittmann Franco', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Pós Venda', ramal: '5550', responsavel: 'Alessandro da Silva Ligabue', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Qualidade', ramal: '5551', responsavel: 'Alex Vieira de Matos', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Saúde e Segurança', ramal: '5566', responsavel: 'Anali Barboza de Lima Chaves', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Controladoria/Fiscal', ramal: '5531', responsavel: 'Ariane Gonchoroski Ferreira', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Almox', ramal: '7030', responsavel: 'Almoxarifado Almox', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Controladoria/Fiscal', ramal: '5532', responsavel: 'Audrea Almeida de Abreu', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Qualidade/Processos', ramal: '5568', responsavel: 'Chaiane Machado Ferreira', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'PCP', ramal: '5577', responsavel: 'Clara Batista Passos da Cruz', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Expedição', ramal: '5591', responsavel: 'Daniel Felix de Souza', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Controladoria/Fiscal', ramal: '5533', responsavel: 'Daniele de Oliveira Alves', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Diretoria Geral', ramal: '5574', responsavel: 'Daniele Heinrich', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Pós Venda', ramal: '5552', responsavel: 'Diessica de Borbaraupp', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Industria', ramal: '5589', responsavel: 'Djovandre Arlan de Andrade', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Qualidade/Processos', ramal: '5569', responsavel: 'Douglas Desouza', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Almox', ramal: '5593', responsavel: 'Ellison Henrique Kaufmann', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Engenharia P&D', ramal: '5556', responsavel: 'Ezequiel Daniele Commarela', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Almox', ramal: '5594', responsavel: 'Fabio Cunha Moreira', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Comercial', ramal: '5541', responsavel: 'Flavio Pereira dos Santos', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Controladoria/Fiscal', ramal: '5534', responsavel: 'Franceline Gilceia Carniel', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Recursos Humanos', ramal: '5565', responsavel: 'Gessimara Fraga da Silva', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Supply Chain', ramal: '5575', responsavel: 'Glaucia Aparecida Kirchhofziegler', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Marketing', ramal: '5548', responsavel: 'Guilherme Oliveiradeoliveira', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Qualidade/Processos', ramal: '5570', responsavel: 'Henrique Oliveira', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Recursos Humanos', ramal: '5562', responsavel: 'Isabel Cristinaschmitzpedroso', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Comercial', ramal: '5542', responsavel: 'Jenifer Janetebatistaviana', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Engenharia P&D', ramal: '5557', responsavel: 'Joao Antoniozago', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Engenharia P&D', ramal: '5558', responsavel: 'Jonata Darosaviana', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Qualidade/Processos', ramal: '5571', responsavel: 'Jordana Cristinadidomenicocunha', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Controladoria/Fiscal', ramal: '5535', responsavel: 'Josiane Alminhana', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'PCP', ramal: '5576', responsavel: 'Josue Albanidarocha', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Industria', ramal: '5585', responsavel: 'Julia Razera', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Almox', ramal: '5595', responsavel: 'Leonardo da Silva', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Saúde e Segurança', ramal: '5567', responsavel: 'Luis Felipeloewenstein', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'PCP', ramal: '5578', responsavel: 'Maicon Dasilveiramachado', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Engenharia P&D', ramal: '5559', responsavel: 'Marcelo Biedrzycki', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Compras', ramal: '5579', responsavel: 'Marcio Izaiascostadasilva', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Compras', ramal: '5580', responsavel: 'Marcio Kelling', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Engenharia P&D', ramal: '5560', responsavel: 'Marcus Gabrielbrasilbarbosa', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Marketing', ramal: '5549', responsavel: 'Mariana Kramerherrmann', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Controladoria/Fiscal', ramal: '5536', responsavel: 'Mariangela Cunhadossantos', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Industria', ramal: '5588', responsavel: 'Miguel Casanovadeoliveirasilva', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Gestão de Produto', ramal: '5547', responsavel: 'Nelson Dasilvaluz', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Diretoria', ramal: '5530', responsavel: 'Daniele Heinrich', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Comercial', ramal: '5546', responsavel: 'Pablo Genricharroyo', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Pós Venda', ramal: '5553', responsavel: 'Patrick Camargogemelli', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Comercial', ramal: '5543', responsavel: 'Pedro Rosalopes', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Portaria', ramal: '7029', responsavel: 'Portaria Portaria', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Qualidade/Processos', ramal: '5572', responsavel: 'Rafael Dasilvaalmansa', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'PCP', ramal: '5581', responsavel: 'Raquel Machadodasilvabrito', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Engenharia P&D', ramal: '5561', responsavel: 'Regis Ribeiro', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Comercial', ramal: '5544', responsavel: 'Renan Sartoriooliveira', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Diretoria', ramal: '5537', responsavel: 'Ricardo Guimaraes', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Industria', ramal: '5586', responsavel: 'Roberto Fialhorochafilho', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Industria', ramal: '5587', responsavel: 'Roger Lairtondasilveiradias', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Compras', ramal: '5582', responsavel: 'Sabrina Darochasackser', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Recursos Humanos', ramal: '5564', responsavel: 'Silvio Guimaraesferreiraaquino', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'TI', ramal: '5501', responsavel: 'Suporte TI', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Expedição', ramal: '5592', responsavel: 'Thais Baideksilveira', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Qualidade/Processos', ramal: '5554', responsavel: 'Thiago Dacosta', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Financeiro', ramal: '5538', responsavel: 'Thiarles Jaimemachadodias', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Qualidade/Processos', ramal: '5573', responsavel: 'Tiago Veigavelho', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Comercial', ramal: '5545', responsavel: 'Tuani Natielleferreiradossantos', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Financeiro', ramal: '5539', responsavel: 'Vanessa Svensonbarros', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Industria', ramal: '5584', responsavel: 'Victor Jonissoares', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'PCP', ramal: '5583', responsavel: 'Wagner Greinertres', telefone: '', celular: '', email: '', emergencia: false, obs: '' },
    { id: uid(), setor: 'Industria', ramal: '5590', responsavel: 'Willian Gomesdossantosbitencourt', telefone: '', celular: '', email: '', emergencia: false, obs: '' }
  ];
}

export function seedDB() {
  const hoje = new Date();
  const iso = (d) => d.toISOString();
  const hAtras = (h) => { const d = new Date(hoje); d.setHours(d.getHours() - h); return iso(d); };
  const dAtras = (dias, hora) => { const d = new Date(hoje); d.setDate(d.getDate() - dias); d.setHours(hora, 15, 0, 0); return iso(d); };

  return {
    acessos: [
      { id: uid(), tipo: 'visitante', nome: 'Ana Paula Souza', documento: '123.456.789-00', empresa: 'TechSul Sistemas', telefone: '(51) 99876-1122', placa: 'IXR4B21', motivo: 'Reunião comercial', visitado: 'Comercial — Ricardo', obs: '', entrada: hAtras(2), saida: null, status: 'Dentro' },
      { id: uid(), tipo: 'motorista', nome: 'Carlos Mendes', documento: '987.654.321-11', empresa: 'TransLog RS', telefone: '(51) 98123-4455', placa: 'JBC2C34', motivo: 'Entrega de matéria-prima', visitado: 'Almoxarifado', obs: 'Carreta no pátio 2', entrada: hAtras(1), saida: null, status: 'Dentro' },
      { id: uid(), tipo: 'prestador', nome: 'João Batista Lima', documento: '456.789.123-22', empresa: 'Eletro Manutenção', telefone: '(51) 99555-7788', placa: '', motivo: 'Manutenção elétrica', visitado: 'Manutenção — Setor B', obs: '', entrada: hAtras(4), saida: null, status: 'Dentro' },
      { id: uid(), tipo: 'interno', nome: 'Fernanda Oliveira', documento: '321.654.987-33', empresa: 'Marcher Brasil', telefone: '(51) 99222-3344', placa: 'IQT9D87', motivo: 'Expediente', visitado: '', obs: '', entrada: dAtras(0, 7), saida: null, status: 'Dentro' },
      { id: uid(), tipo: 'visitante', nome: 'Marcos Vinícius Rocha', documento: '111.222.333-44', empresa: 'Consultoria Apex', telefone: '(11) 98888-1100', placa: '', motivo: 'Auditoria', visitado: 'Financeiro', obs: '', entrada: dAtras(1, 9), saida: dAtras(1, 12), status: 'Saiu' },
      { id: uid(), tipo: 'motorista', nome: 'Paulo Roberto Dias', documento: '555.666.777-88', empresa: 'Rota Sul Transportes', telefone: '(51) 97777-2211', placa: 'MNB3E45', motivo: 'Coleta de produto acabado', visitado: 'Expedição', obs: '', entrada: dAtras(2, 14), saida: dAtras(2, 16), status: 'Saiu' },
      { id: uid(), tipo: 'entrega', nome: 'Entregador — SediEx', documento: '999.888.777-66', empresa: 'SediEx', telefone: '', placa: 'PKL7F12', motivo: 'Entrega de encomenda', visitado: 'Recepção', obs: '', entrada: dAtras(1, 10), saida: dAtras(1, 10), status: 'Saiu' }
    ],
    visitantes: [
      { id: uid(), nome: 'Ana Paula Souza', documento: '123.456.789-00', telefone: '(51) 99876-1122', empresa: 'TechSul Sistemas', obs: 'Visita mensal — comercial', ativo: true },
      { id: uid(), nome: 'Marcos Vinícius Rocha', documento: '111.222.333-44', telefone: '(11) 98888-1100', empresa: 'Consultoria Apex', obs: 'Auditor externo', ativo: true },
      { id: uid(), nome: 'Beatriz Almeida', documento: '222.333.444-55', telefone: '(51) 99111-9988', empresa: 'Gráfica Pampa', obs: '', ativo: false }
    ],
    motoristas: [
      { id: uid(), nome: 'Carlos Mendes', documento: 'CNH 01234567890', telefone: '(51) 98123-4455', transportadora: 'TransLog RS', placaPadrao: 'JBC2C34', tipoVeiculo: 'carreta', obs: '', ativo: true },
      { id: uid(), nome: 'Paulo Roberto Dias', documento: 'CNH 09876543210', telefone: '(51) 97777-2211', transportadora: 'Rota Sul Transportes', placaPadrao: 'MNB3E45', tipoVeiculo: 'caminhão', obs: 'Coletas semanais', ativo: true }
    ],
    veiculos: [
      { id: uid(), placa: 'JBC2C34', tipo: 'carreta', modelo: 'Scania R450', cor: 'Branca', proprietario: 'TransLog RS', motorista: 'Carlos Mendes', obs: '' },
      { id: uid(), placa: 'MNB3E45', tipo: 'caminhão', modelo: 'VW Constellation', cor: 'Vermelha', proprietario: 'Rota Sul Transportes', motorista: 'Paulo Roberto Dias', obs: '' },
      { id: uid(), placa: 'IQT9D87', tipo: 'carro', modelo: 'Fiat Argo', cor: 'Prata', proprietario: 'Marcher Brasil', motorista: 'Fernanda Oliveira', obs: 'Frota interna' }
    ],
    entregas: [
      { id: uid(), tipo: 'recebimento', fornecedor: 'AçoForte Distribuidora', motorista: 'Carlos Mendes', placa: 'JBC2C34', nf: 'NF 45.218', descricao: 'Chapas de aço 3mm', volumes: 12, destinatario: 'Almoxarifado', setor: 'Suprimentos', status: 'pendente', obs: 'Conferir com pedido 7741', data: hAtras(1) },
      { id: uid(), tipo: 'recebimento', fornecedor: 'SediEx', motorista: 'Entregador — SediEx', placa: 'PKL7F12', nf: 'NF 10.992', descricao: 'Material de escritório', volumes: 3, destinatario: 'Administrativo', setor: 'Compras', status: 'entregue', obs: '', data: dAtras(1, 10) },
      { id: uid(), tipo: 'coleta', fornecedor: 'Rota Sul Transportes', motorista: 'Paulo Roberto Dias', placa: 'MNB3E45', nf: 'NF 88.310', descricao: 'Produto acabado — lote 2206', volumes: 40, destinatario: 'Cliente Final', setor: 'Expedição', status: 'recebido', obs: '', data: dAtras(2, 14) },
      { id: uid(), tipo: 'retirada', fornecedor: 'Eletro Manutenção', motorista: '', placa: '', nf: 'OS 1.022', descricao: 'Motor para reparo externo', volumes: 1, destinatario: 'Oficina externa', setor: 'Manutenção', status: 'cancelado', obs: 'Reagendado', data: dAtras(3, 11) }
    ],
    ramais: seedRamais()
  };
}
