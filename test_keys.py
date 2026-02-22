from langchain_openai import ChatOpenAI

keys = [
    ('Key 1', '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'),
    ('Key 2', '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'),
    ('Key 3', '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'),
    ('Current', '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')
]

working_key = None

for name, key in keys:
    print(f'\nTesting {name}: {key[:25]}...')
    try:
        llm = ChatOpenAI(
            model='arcee-ai/trinity-large-preview:free',
            temperature=0.5,
            api_key=key,
            base_url='https://openrouter.ai/api/v1',
            max_tokens=50
        )
        response = llm.invoke('Say hello in one word')
        print(f'✓ {name} WORKS! Response: {response.content}')
        working_key = key
        break
    except Exception as e:
        print(f'✗ {name} failed: {str(e)[:100]}')

if working_key:
    print(f'\n\n✓✓✓ WORKING KEY FOUND: {working_key}')
else:
    print('\n\n✗✗✗ NO WORKING KEYS - ALL OPENROUTER KEYS ARE INVALID')
    print('You need to generate a new API key from https://openrouter.ai/keys')
