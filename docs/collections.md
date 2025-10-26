=== COLLECTIONS USADAS PELO BACKEND NEXT.JS ===

1. messages
   - Descrição: Armazena mensagens enviadas pelos fãs e o status de publicação moderado.
   - Modelo: lib/models/Message.ts
   - Usado em: /api/messages/*, /admin/messages/*

2. media
   - Descrição: Biblioteca de arquivos hospedados no Cloudinary, reutilizada em todo o painel.
   - Modelo: lib/models/Media.ts (lib/models/UploadFile.ts exporta o mesmo modelo para compatibilidade)
   - Usado em: /api/media/*, /api/upload/*, componentes de upload de imagens/áudio

3. books
   - Descrição: Catálogo de livros relacionados a Zé Ramalho.
   - Modelo: lib/models/Book.ts
   - Usado em: /api/books/*, /admin/books/*

4. cds
   - Descrição: Discografia em CD com capas e faixas associadas.
   - Modelo: lib/models/Cd.ts
   - Usado em: /api/cds/*, /admin/cds/*

5. cdtracks
   - Descrição: Armazena as faixas individuais dos CDs.
   - Modelo: lib/models/CdTrack.ts
   - Usado em: /api/cds/* (popular faixas), utilidades internas de importação

6. dvds
   - Descrição: Coletânea de DVDs e vídeos oficiais.
   - Modelo: lib/models/Dvd.ts
   - Usado em: /api/dvds/*, /admin/dvds/*

7. dvdtracks
   - Descrição: Lista de faixas de áudio/vídeo associadas aos DVDs.
   - Modelo: lib/models/DvdTrack.ts
   - Usado em: /api/dvds/* (popular faixas)

8. clips
   - Descrição: Clips oficiais publicados no site.
   - Modelo: lib/models/Clip.ts
   - Usado em: /api/clips/*, /admin/clips/*

9. lyrics
   - Descrição: Letras de músicas com informações de composição.
   - Modelo: lib/models/Lyric.ts
   - Usado em: /api/lyrics/*, /admin/lyrics/*

10. photos (components_photo_photos)
    - Descrição: Galeria de fotos históricas e promocionais.
    - Modelo: lib/models/Photo.ts
    - Usado em: /api/photos/*, /admin/photos/*

11. shows
    - Descrição: Agenda de shows e apresentações.
    - Modelo: lib/models/Show.ts
    - Usado em: /api/shows/*, /admin/shows/*

12. texts
    - Descrição: Artigos e textos editoriais publicados no portal.
    - Modelo: lib/models/Text.ts
    - Usado em: /api/texts/*, /admin/texts/*

13. passwordresettokens
    - Descrição: Tokens temporários para recuperação de senha dos administradores.
    - Modelo: lib/models/PasswordResetToken.ts
    - Usado em: fluxos de autenticação (reset de senha)

14. admins
    - Descrição: Contas de administradores do painel Next.js.
    - Modelo: lib/models/Admin.ts
    - Usado em: autenticação NextAuth, /api/admin/*

15. shows (component collections auxiliares)
    - components_cd_tracks e components_dvd_tracks são coleções auxiliares legadas utilizadas para ordenação de faixas.
    - Consumidas diretamente via connectMongo() em app/admin/page.tsx para estatísticas.

=== COLLECTIONS QUE PODEM SER DELETADAS ===

1. strapi_administrator (motivo: legado do Strapi, não há modelo Mongoose correspondente)
2. strapi_permission (motivo: legado do Strapi)
3. strapi_role (motivo: legado do Strapi)
4. core_store (motivo: legado do Strapi)
5. i18n_locales (motivo: legado do Strapi)
6. mensagens (motivo: collection antiga em PT-BR não utilizada; substituída por "messages")
7. upload_file / uploadfiles (motivo: legado do Strapi; o backend atual utiliza a coleção "media")
8. strapi_webhooks (motivo: legado do Strapi)

=== ESCLARECIMENTOS ===

- users-permissions_role: collection criada pelo Strapi antigo para perfis de usuários. Não é utilizada pelo backend Next.js.
- users-permissions_user: também originária do Strapi (usuários finais). Pode ser removida caso não exista outra dependência externa.
- users-permissions_permission: permissões do plugin Users & Permissions do Strapi legado. Não é utilizada no backend Next.js.
