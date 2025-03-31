import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class TaskScreen extends StatefulWidget {
  const TaskScreen({super.key});

  @override
  _TaskScreenState createState() => _TaskScreenState();
}

class _TaskScreenState extends State<TaskScreen> {
  List<dynamic> _tasks = [];
  bool _showTodayTasks = true;
  final TextEditingController _taskController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchTasks();
  }

  Future<void> _fetchTasks() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    String? token = prefs.getString('token');
    if (token == null) return;

    final response = await http.get(
      Uri.parse(
        'http://192.168.1.7:3000/tasks?time=${_showTodayTasks ? "Today" : "Week"}',
        // 'http://10.0.2.2:3000/tasks?time=${_showTodayTasks ? "Today" : "Week"}',
      ),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      setState(() {
        _tasks = jsonDecode(response.body);
      });
    }
  }

  Future<void> _removeTask(int taskId) async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    String? token = prefs.getString('token');
    if (token == null) return;

    final response = await http.delete(
      Uri.parse('http://192.168.1.7:3000/tasks/$taskId'),
      // Uri.parse('http://10.0.2.2:3000/tasks/$taskId'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      setState(() {
        _tasks.removeWhere((task) => task['id'] == taskId);
      });
    }
  }
  Future<void> _editTask(
    int taskId,
    String newTitle,
    String currentTime,
  ) async {
    if (newTitle.isEmpty) return;

    SharedPreferences prefs = await SharedPreferences.getInstance();
    String? token = prefs.getString('token');
    if (token == null) return;

    final response = await http.put(
      // Uri.parse('http://10.0.2.2:3000/tasks/$taskId'),
      Uri.parse('http://192.168.1.7:3000/tasks/$taskId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'title': newTitle, 'time': currentTime}),
    );

    if (response.statusCode == 200) {
      setState(() {
        _tasks =
            _tasks.map((task) {
              if (task['id'] == taskId) {
                task['title'] = newTitle;
              }
              return task;
            }).toList();
      });
    }
  }


  Future<void> _addTask() async {
    if (_taskController.text.isEmpty) return;

    SharedPreferences prefs = await SharedPreferences.getInstance();
    String? token = prefs.getString('token');
    if (token == null) return;

    final response = await http.post(
      Uri.parse('http://192.168.1.7:3000/tasks'),
      // Uri.parse('http://10.0.2.2:3000/tasks'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'title': _taskController.text,
        'time': _showTodayTasks ? 'Today' : 'Week',
      }),
    );

    if (response.statusCode == 201) {
      _taskController.clear();
      _fetchTasks();
    }
  }

  void _toggleTaskView() {
    setState(() {
      _showTodayTasks = !_showTodayTasks;
    });
    _fetchTasks();
  }

  void _showEditDialog(int taskId, String currentTitle, String currentTime) {
    TextEditingController editController = TextEditingController(
      text: currentTitle,
    );

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text("Edit Task"),
          content: TextField(
            controller: editController,
            decoration: InputDecoration(hintText: "Enter new task title"),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text("Cancel"),
            ),
            TextButton(
              onPressed: () {
                _editTask(taskId, editController.text, currentTime);
                Navigator.pop(context);
              },
              child: Text("Save"),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Colors.purple, Colors.deepPurple], // Gradient background
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Column(
              children: [
                // App Title
                Text(
                  "Permalist",
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 12),
                // Task Input Field
                TextField(
                  controller: _taskController,
                  decoration: InputDecoration(
                    hintText: "Enter a task",
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    suffixIcon: IconButton(
                      icon: Icon(Icons.add, color: Colors.purple),
                      onPressed: _addTask,
                    ),
                  ),
                ),
                SizedBox(height: 10),
                // Task Filter Toggle
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "Showing: ${_showTodayTasks ? "Today's Tasks" : "Weekly Tasks"}",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    ElevatedButton(
                      onPressed: _toggleTaskView,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.purple,
                      ),
                      child: Text(_showTodayTasks ? "Show Week" : "Show Today"),
                    ),
                  ],
                ),
                SizedBox(height: 10),
                // Task List
                Expanded(
                  child: ListView.builder(
                    itemCount: _tasks.length,
                    itemBuilder: (context, index) {
                      return Card(
                        color: Colors.white,
                        margin: EdgeInsets.symmetric(
                          vertical: 5,
                          horizontal: 2,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: 10,
                            horizontal: 10,
                          ),
                          child: Row(
                            crossAxisAlignment:
                                CrossAxisAlignment.start, // Align properly
                            children: [
                              // Serial Number (Aligned and Less Wasted Space)
                              SizedBox(
                                width: 20, // Reduce width
                                child: Text(
                                  "${index + 1}.",
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.purple,
                                  ),
                                ),
                              ),
                              SizedBox(width: 8), // Small gap before text
                              // Task Title
                              Expanded(
                                child: Text(
                                  _tasks[index]['title'],
                                  style: TextStyle(fontSize: 16),
                                  softWrap: true,
                                ),
                              ),
                              // Icons (Compact and Right-Aligned)
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: Icon(
                                      Icons.edit,
                                      color: Colors.purple,
                                      size: 18,
                                    ),
                                    onPressed:
                                        () => _showEditDialog(
                                          _tasks[index]['id'],
                                          _tasks[index]['title'],
                                          _tasks[index]['time'],
                                        ),
                                    padding:
                                        EdgeInsets.zero, // Remove extra spacing
                                    constraints:
                                        BoxConstraints(), // Shrink button size
                                  ),
                                  SizedBox(
                                    width: 4,
                                  ), // Reduce space between icons
                                  IconButton(
                                    icon: Icon(
                                      Icons.delete,
                                      color: Colors.red,
                                      size: 18,
                                    ),
                                    onPressed:
                                        () => _removeTask(_tasks[index]['id']),
                                    padding: EdgeInsets.zero,
                                    constraints: BoxConstraints(),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
