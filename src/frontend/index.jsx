import React, { useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  EmptyState,
  SectionMessage,
  Stack,
  Text,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  DONE: 'done',
  EMPTY: 'empty',
  ERROR: 'error',
  UNLICENSED: 'unlicensed',
};

const App = () => {
  const [state, setState] = useState(STATE.IDLE);
  const [summary, setSummary] = useState('');
  const [fallback, setFallback] = useState(false);

  const handleSummarize = async () => {
    setState(STATE.LOADING);
    try {
      const result = await invoke('summarizeTicket');
      if (result.unlicensed) {
        setState(STATE.UNLICENSED);
        return;
      }
      if (result.empty) {
        setState(STATE.EMPTY);
        return;
      }
      setSummary(result.summary);
      setFallback(Boolean(result.fallback));
      setState(STATE.DONE);
    } catch (err) {
      setState(STATE.ERROR);
    }
  };

  return (
    <Box padding="space.100">
      <Stack space="space.100">
        {state === STATE.IDLE && (
          <Button appearance="primary" onClick={handleSummarize}>
            Summarize this ticket
          </Button>
        )}

        {state === STATE.LOADING && <Text>Reading the ticket…</Text>}

        {state === STATE.DONE && (
          <Stack space="space.100">
            <Text>{summary}</Text>
            {fallback && (
              <SectionMessage appearance="warning" title="Simplified summary">
                <Text>
                  The AI summary could not be generated, so this is a plain, computed summary
                  instead.
                </Text>
              </SectionMessage>
            )}
            <Button onClick={handleSummarize}>Regenerate</Button>
          </Stack>
        )}

        {state === STATE.EMPTY && (
          <EmptyState
            header="Nothing to summarize yet"
            description="This ticket has no comments or status changes yet."
          />
        )}

        {state === STATE.UNLICENSED && (
          <SectionMessage appearance="warning" title="A subscription is required">
            <Text>
              This installation doesn't have an active Passdown subscription. Ask your Jira
              admin to start a trial or subscribe from the Atlassian Marketplace.
            </Text>
          </SectionMessage>
        )}

        {state === STATE.ERROR && (
          <SectionMessage appearance="error" title="Couldn't summarize this ticket">
            <Text>Something went wrong reading this ticket. Try again.</Text>
            <Button onClick={handleSummarize}>Try again</Button>
          </SectionMessage>
        )}
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
