#include "../cpp/include/tracelify.h"
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
#include <system_error>
#include <regex>
#include <future>
#include <bitset>
#include <typeinfo>
#include <ios>

class DatabaseError : public std::runtime_error {
public: DatabaseError(const std::string& m) : std::runtime_error(m) {}
};
class AuthenticationError : public std::runtime_error {
public: AuthenticationError(const std::string& m) : std::runtime_error(m) {}
};

int main() {
  std::cout << "=== Tracelify C++ SDK — Integration Test (20 Errors) ===\n";
  tracelify::Tracelify sdk("http://2b91d0f4765477cb0760c25f23f35b4d@54.251.156.151.nip.io:8000/api/55a3821c-eddf-4c44-9897-010dfe09da57/events", "1.0.0");

  auto capture = [&](int idx, const std::exception& e) {
    std::cout << "[" << idx << "] Capturing exception...\n";
    sdk.capture_exception(e);
  };

  try { throw std::runtime_error("1 runtime"); } catch (const std::exception& e) { capture(1, e); }
  try { std::vector<int> v; v.at(5); } catch (const std::exception& e) { capture(2, e); }
  try { throw std::invalid_argument("3 invalid"); } catch (const std::exception& e) { capture(3, e); }
  try { throw std::logic_error("4 logic"); } catch (const std::exception& e) { capture(4, e); }
  try { throw std::domain_error("5 domain"); } catch (const std::exception& e) { capture(5, e); }
  try { std::string s; s.resize(s.max_size() + 1); } catch (const std::exception& e) { capture(6, e); }
  try { throw std::overflow_error("7 overflow"); } catch (const std::exception& e) { capture(7, e); }
  try { throw std::underflow_error("8 underflow"); } catch (const std::exception& e) { capture(8, e); }
  try { throw std::range_error("9 range"); } catch (const std::exception& e) { capture(9, e); }
  try { throw std::bad_alloc(); } catch (const std::exception& e) { capture(10, e); }
  try { struct A{virtual ~A(){}}; struct B:A{}; A* a=new A; B& b=dynamic_cast<B&>(*a); } catch (const std::exception& e) { capture(11, e); }
  try { struct A{virtual ~A(){}}; A* a=nullptr; typeid(*a); } catch (const std::exception& e) { capture(12, e); }
  try { throw std::regex_error(std::regex_constants::error_badrepeat); } catch (const std::exception& e) { capture(13, e); }
  try { throw std::system_error(std::make_error_code(std::errc::invalid_argument)); } catch (const std::exception& e) { capture(14, e); }
  try { std::promise<int> p; p.get_future(); p.get_future(); } catch (const std::exception& e) { capture(15, e); }
  try { std::bitset<1> b; b.test(2); } catch (const std::exception& e) { capture(16, e); }
  try { std::stoi("not a number"); } catch (const std::exception& e) { capture(17, e); }
  try { throw DatabaseError("18 db failed"); } catch (const std::exception& e) { capture(18, e); }
  try { throw AuthenticationError("19 auth denied"); } catch (const std::exception& e) { capture(19, e); }
  try { throw std::ios_base::failure("20 ios failure"); } catch (const std::exception& e) { capture(20, e); }

  std::cout << "\n✅ Done\n";
  return 0;
}
