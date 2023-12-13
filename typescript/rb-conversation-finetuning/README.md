# rb-conversation-finetuning

Generating finetuning data for rabbit OS' conversation system.

## Running

```
typescript/common/pkg-deps-run.sh rb-conversation-finetuning local/build.sh 
typescript/rb-conversation-finetuning/local/run.sh
```

### Claude prompts for conversation traces

```
Simulate 10 conversations between a user and an AI assistant, where the user says, ${USER}, and the AI responds with ${AI}
```