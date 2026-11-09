# Implementação da Fase 03: Módulo BNCC, Cursos, Turmas e Matrículas (3FN) - EduPlanner

## 1. Visão Geral da Fase 03
A Fase 03 constrói os agregados centrais do domínio pedagógico do **EduPlanner**: o Catálogo de Habilidades da BNCC, a estrutura organizacional de Cursos e Turmas e a gestão de Matrículas rigorosamente adequada à **Terceira Forma Normal (3FN)**. Esta camada sustenta a rastreabilidade de todas as ações pedagógicas subsequentes (Diagnóstico, SWOT, Planos e Kumon).

---

## 2. Modelagem de Domínio (Clean Architecture / DDD)

### Entidades e Agregados Principais:
1. **`HabilidadeBNCC` (Agregado BNCC)**:
   - Atributos: `codigo` (ex.: `EF05MA03`), `descricao`, `anoEscolar`, `componenteCurricular`.
   - Invariante: O código deve respeitar a estrutura alfanumérica oficial definida pelo Ministério da Educação.

2. **`Curso` & `Turma` (Agregado Estrutura Escolar)**:
   - `Curso`: `id`, `nomeCurso`, `nivelEnsino`.
   - `Turma`: `id`, `cursoId`, `nomeTurma`, `anoLetivo`.

3. **`Estudante` & `Matricula` (Agregado Aluno - 3FN Estrita)**:
   - `Estudante`: Dados intrínsecos do indivíduo (`id`, `nome`, `necessidadesEspeciais`).
   - `Matricula`: Entidade associativa de ligação temporal (`id`, `estudanteId`, `turmaId`, `status`, `dataMatricula`).
   - Invariante: Um estudante não pode possuir duas matrículas com status `ATIVA` simultaneamente na mesma turma (`uk_estudante_turma_ativa`).

---

## 3. Serviços de Aplicação e Casos de Uso

### A. Importer do Catálogo BNCC (`CarregarCatalogoBNCCUseCase`)
Responsável por carregar, validar e indexar o catálogo oficial de habilidades da BNCC para rápido acesso em memória (Redis) e persistência relacional.

```typescript
export class CarregarCatalogoBNCCUseCase {
  constructor(private bnccRepository: IBNCCRepository) {}

  async execute(habilidades: HabilidadeBNCCInputDTO[]): Promise<void> {
    for (const dto of habilidades) {
      if (!this.validarCodigoBNCCFormat(dto.codigo)) {
        throw new DomainException(`Código BNCC inválido: ${dto.codigo}`);
      }
      await this.bnccRepository.saveOrUpdate(dto);
    }
  }

  private validarCodigoBNCCFormat(codigo: string): boolean {
    const regexBNCC = /^[A-Z]{2}\d{2}[A-Z]{2}\d{2}$/;
    return regexBNCC.test(codigo);
  }
}
```

### B. Gestão de Matrícula (`MatricularEstudanteUseCase`)
Garante a vinculação do aluno à turma e trata a exceção de duplicidade ativa.

```typescript
export class MatricularEstudanteUseCase {
  constructor(
    private matriculaRepository: IMatriculaRepository,
    private estudanteRepository: IEstudanteRepository
  ) {}

  async execute(input: MatricularEstudanteDTO): Promise<MatriculaResponseDTO> {
    const existeAtiva = await this.matriculaRepository.hasMatriculaAtiva(
      input.estudanteId,
      input.turmaId
    );

    if (existeAtiva) {
      throw new ConflictException(
        'O estudante já possui uma matrícula ativa nesta turma.',
        'ERR_DUPLICATE_ACTIVE_MATRICULA'
      );
    }

    const matricula = new Matricula({
      estudanteId: input.estudanteId,
      turmaId: input.turmaId,
      status: 'ATIVA',
      dataMatricula: new Date()
    });

    await this.matriculaRepository.save(matricula);
    return MatriculaMapper.toDTO(matricula);
  }
}
```

---

## 4. Camada de Persistência (PostgreSQL Repositories)

Mapeamento relacional dos agregados utilizando Repositórios do TypeORM/Prisma com tratamento de constraints do banco de dados.

```typescript
export class PostgresMatriculaRepository implements IMatriculaRepository {
  constructor(private db: DatabaseClient) {}

  async hasMatriculaAtiva(estudanteId: string, turmaId: string): Promise<boolean> {
    const count = await this.db.query(
      `SELECT COUNT(1) FROM tb_matricula 
       WHERE id_estudante = $1 AND id_turma = $2 AND st_matricula = 'ATIVA'`,
      [estudanteId, turmaId]
    );
    return parseInt(count.rows[0].count, 10) > 0;
  }

  async save(matricula: Matricula): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO tb_matricula (id_matricula, id_estudante, id_turma, st_matricula, dt_matricula)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          matricula.id,
          matricula.estudanteId,
          matricula.turmaId,
          matricula.status,
          matricula.dataMatricula
        ]
      );
    } catch (error: any) {
      if (error.code === '23505') { // Postgres Unique Violation
        throw new ConflictException(
          'Violação de Matrícula Ativa Única.',
          'ERR_DUPLICATE_ACTIVE_MATRICULA'
        );
      }
      throw error;
    }
  }
}
```

---

## 5. Suite de Testes Automatizados da Fase 03

```typescript
describe('Fase 03 - Testes do Módulo BNCC e Matrículas (3FN)', () => {
  it('Deve bloquear tentativa de matrícula ativa duplicada na mesma turma', async () => {
    const mockRepo = new MockMatriculaRepository();
    const useCase = new MatricularEstudanteUseCase(mockRepo, new MockEstudanteRepository());

    const input = {
      estudanteId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      turmaId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e'
    };

    // Primeira matrícula
    await useCase.execute(input);

    // Segunda tentativa simultânea (Deve lançar exceção)
    await expect(useCase.execute(input)).rejects.toThrow(
      'O estudante já possui uma matrícula ativa nesta turma.'
    );
  });

  it('Deve validar a sintaxe dos códigos de habilidades da BNCC', () => {
    const useCase = new CarregarCatalogoBNCCUseCase(new MockBNCCRepository());
    
    expect(() => useCase['validarCodigoBNCCFormat']('EF05MA03')).toBe(true);
    expect(() => useCase['validarCodigoBNCCFormat']('CODIGO_INVALIDO')).toBe(false);
  });
});
```
