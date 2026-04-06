-- Survey Builder Schema
-- Schema: {{schemaName}}

CREATE TABLE IF NOT EXISTS {{schemaName}}.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid,
  is_active bool NOT NULL DEFAULT true,
  allow_anonymous bool NOT NULL DEFAULT {{allowAnonymous}},
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES {{schemaName}}.surveys(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('single', 'multi', 'text', 'rating', 'matrix')),
  title text NOT NULL,
  required bool NOT NULL DEFAULT false,
  options jsonb DEFAULT '[]'::jsonb,
  logic_rules jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES {{schemaName}}.surveys(id) ON DELETE CASCADE,
  respondent_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

CREATE TABLE IF NOT EXISTS {{schemaName}}.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES {{schemaName}}.responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES {{schemaName}}.questions(id) ON DELETE CASCADE,
  value jsonb NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_questions_survey_id ON {{schemaName}}.questions(survey_id, order_index);
CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON {{schemaName}}.responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_respondent_id ON {{schemaName}}.responses(respondent_id);
CREATE INDEX IF NOT EXISTS idx_answers_response_id ON {{schemaName}}.answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON {{schemaName}}.answers(question_id);

-- Enable RLS
ALTER TABLE {{schemaName}}.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{schemaName}}.answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active surveys" ON {{schemaName}}.surveys
  FOR SELECT USING (is_active = true);

CREATE POLICY "Survey owners manage surveys" ON {{schemaName}}.surveys
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Anyone can view questions of active surveys" ON {{schemaName}}.questions
  FOR SELECT USING (
    survey_id IN (SELECT id FROM {{schemaName}}.surveys WHERE is_active = true)
  );

CREATE POLICY "Users can create and view own responses" ON {{schemaName}}.responses
  FOR ALL USING (respondent_id = auth.uid() OR respondent_id IS NULL);

CREATE POLICY "Users can insert answers" ON {{schemaName}}.answers
  FOR INSERT WITH CHECK (true);
