import unittest
from auth import register_user, login_user

class AuthTests(unittest.TestCase):
    def test_register_and_login(self):
        username = "test_user"
        password = "secret123"
        # In a real test, clean state or use a test DB
        register_user(username, password)
        user = login_user(username, password)
        self.assertIsNotNone(user)
        self.assertEqual(user["username"], username)

if __name__ == "__main__":
    unittest.main()