-- Mailed-in and uploaded documents are not public just because they are stored.
--
-- visibility  public: anyone may list it (a Judicial Council form, pulled by number)
--             owner:  only the owner, with the owner pass, may list or open it
-- source      form | upload | email
-- from_hash   the sender's address, hashed: enough to rate-limit, never stored in the clear
-- subject     the email's subject, so an emailed file is recognisable later

ALTER TABLE library_documents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE library_documents ADD COLUMN source TEXT NOT NULL DEFAULT 'form';
ALTER TABLE library_documents ADD COLUMN from_hash TEXT;
ALTER TABLE library_documents ADD COLUMN subject TEXT;

CREATE INDEX IF NOT EXISTS library_documents_visibility ON library_documents (visibility, updated_at);
CREATE INDEX IF NOT EXISTS library_documents_from ON library_documents (from_hash, created_at);
