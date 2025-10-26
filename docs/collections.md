=== COLLECTIONS USADAS PELO BACKEND NEXT.JS ===

1. messages
   - Descrição: Armazena mensagens enviadas pelos fãs e o status de publicação moderado.
   - Modelo: lib/models/Message.ts
   - Usado em: /api/messages/*, /admin/messages/*

2. upload_file
   - Descrição: Biblioteca legada de arquivos (capas, áudios, imagens) herdada do Strapi e ainda referenciada por CDs, DVDs e fotos.
   - Modelo: lib/models/UploadFile.ts
   - Usado em: /api/upload/*, /api/cds/* (capas e faixas), /api/dvds/*, /api/photos/*

3. media
   - Descrição: Biblioteca de arquivos hospedados no Cloudinary adotada pelo novo painel.
   - Modelo: lib/models/Media.ts
   - Usado em: /api/media/*, componentes de upload recentes

4. books
   - Descrição: Catálogo de livros relacionados a Zé Ramalho.
   - Modelo: lib/models/Book.ts
   - Usado em: /api/books/*, /admin/books/*

5. cds
   - Descrição: Discografia em CD com capas e faixas associadas.
   - Modelo: lib/models/Cd.ts
   - Usado em: /api/cds/*, /admin/cds/*

6. cdtracks
   - Descrição: Armazena as faixas individuais dos CDs.
   - Modelo: lib/models/CdTrack.ts
   - Usado em: /api/cds/* (popular faixas), utilidades internas de importação

7. dvds
   - Descrição: Coletânea de DVDs e vídeos oficiais.
   - Modelo: lib/models/Dvd.ts
   - Usado em: /api/dvds/*, /admin/dvds/*

8. dvdtracks
   - Descrição: Lista de faixas de áudio/vídeo associadas aos DVDs.
   - Modelo: lib/models/DvdTrack.ts
   - Usado em: /api/dvds/* (popular faixas)

9. clips
   - Descrição: Clips oficiais publicados no site.
   - Modelo: lib/models/Clip.ts
   - Usado em: /api/clips/*, /admin/clips/*

10. lyrics
    - Descrição: Letras de músicas com informações de composição.
    - Modelo: lib/models/Lyric.ts
    - Usado em: /api/lyrics/*, /admin/lyrics/*

11. photos (components_photo_photos)
    - Descrição: Galeria de fotos históricas e promocionais.
    - Modelo: lib/models/Photo.ts
    - Usado em: /api/photos/*, /admin/photos/*

12. shows
    - Descrição: Agenda de shows e apresentações.
    - Modelo: lib/models/Show.ts
    - Usado em: /api/shows/*, /admin/shows/*

13. texts
    - Descrição: Artigos e textos editoriais publicados no portal.
    - Modelo: lib/models/Text.ts
    - Usado em: /api/texts/*, /admin/texts/*

14. passwordresettokens
    - Descrição: Tokens temporários para recuperação de senha dos administradores.
    - Modelo: lib/models/PasswordResetToken.ts
    - Usado em: fluxos de autenticação (reset de senha)

15. admins
    - Descrição: Contas de administradores do painel Next.js.
    - Modelo: lib/models/Admin.ts
    - Usado em: autenticação NextAuth, /api/admin/*

16. shows (component collections auxiliares)
    - components_cd_tracks e components_dvd_tracks são coleções auxiliares legadas utilizadas para ordenação de faixas.
    - Consumidas diretamente via connectMongo() em app/admin/page.tsx para estatísticas.

=== COLLECTIONS QUE PODEM SER DELETADAS ===

1. strapi_administrator (motivo: legado do Strapi, não há modelo Mongoose correspondente)
2. strapi_permission (motivo: legado do Strapi)
3. strapi_role (motivo: legado do Strapi)
4. core_store (motivo: legado do Strapi)
5. i18n_locales (motivo: legado do Strapi)
6. mensagens (motivo: collection antiga em PT-BR não utilizada; substituída por "messages")
7. uploadfiles (motivo: duplicata antiga do Strapi não utilizada pelo backend Next.js)
8. strapi_webhooks (motivo: legado do Strapi)

=== ESCLARECIMENTOS ===

- users-permissions_role: collection criada pelo Strapi antigo para perfis de usuários. Não é utilizada pelo backend Next.js.
- users-permissions_user: também originária do Strapi (usuários finais). Pode ser removida caso não exista outra dependência externa.
- users-permissions_permission: permissões do plugin Users & Permissions do Strapi legado. Não é utilizada no backend Next.js.
