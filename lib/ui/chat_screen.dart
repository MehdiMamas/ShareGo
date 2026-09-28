import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/session.dart';
import '../strings.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.session});

  final Session session;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final messages = widget.session.messages;
    return Column(
      children: [
        Expanded(
          child: messages.isEmpty
              ? const Center(child: Text(S.emptyChat))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[index];
                    return Align(
                      alignment: message.outgoing ? Alignment.centerRight : Alignment.centerLeft,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 360),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                SelectableText(message.text),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      message.outgoing
                                          ? (message.delivered ? S.delivered : S.sending)
                                          : '',
                                      style: Theme.of(context).textTheme.labelSmall,
                                    ),
                                    IconButton(
                                      tooltip: S.copy,
                                      onPressed: () async {
                                        await Clipboard.setData(ClipboardData(text: message.text));
                                        if (!context.mounted) return;
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text(S.copied)),
                                        );
                                      },
                                      icon: const Icon(Icons.copy, size: 18),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _input,
                  decoration: const InputDecoration(hintText: S.messageHint),
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(onPressed: _send, child: const Text(S.send)),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _send() async {
    final text = _input.text;
    final sent = await widget.session.sendText(text);
    if (sent) _input.clear();
  }
}
