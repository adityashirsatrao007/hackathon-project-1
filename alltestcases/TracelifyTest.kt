import com.tracelify.Tracelify
import java.io.FileNotFoundException
import java.io.IOException
import java.lang.IllegalArgumentException
import java.lang.IllegalStateException
import java.lang.IndexOutOfBoundsException
import java.lang.NumberFormatException
import java.lang.UnsupportedOperationException
import java.lang.ClassCastException
import java.lang.RuntimeException
import java.util.NoSuchElementException
import java.util.ConcurrentModificationException
import java.text.ParseException

fun main() {
    val DSN = "http://24910fd46216c29e346fb96e87719a0d@54.251.156.151.nip.io:8000/api/99edd5b2-b7c8-44aa-8f8b-ff3280fa3f28/events"
    println("=== Tracelify Kotlin SDK — Integration Test (20 Errors) ===")
    
    val sdk = Tracelify(DSN, "1.0.0")
    sdk.setUser(mapOf("id" to "usr_kt_01", "name" to "Kotlin Tester"))
    sdk.setTag("env", "production")

    fun capture(idx: Int, e: Throwable) {
        println("[$idx] Capturing ${e.javaClass.simpleName}...")
        sdk.captureException(e)
    }

    try { val s: String? = null; s!!.length } catch (e: Exception) { capture(1, e) }
    try { val x = 10 / 0 } catch (e: Exception) { capture(2, e) }
    try { throw FileNotFoundException("/abc") } catch (e: Exception) { capture(3, e) }
    try { throw IllegalArgumentException("Bad arg") } catch (e: Exception) { capture(4, e) }
    try { throw IllegalStateException("Bad state") } catch (e: Exception) { capture(5, e) }
    try { val arr = arrayOf(1); arr[5] } catch (e: Exception) { capture(6, e) }
    try { throw UnsupportedOperationException("Not supported") } catch (e: Exception) { capture(7, e) }
    try { "abc".toInt() } catch (e: Exception) { capture(8, e) }
    try { val a: Any = "A"; val b = a as Int } catch (e: Exception) { capture(9, e) }
    try { throw NoSuchElementException("No element") } catch (e: Exception) { capture(10, e) }
    try { throw ConcurrentModificationException("Modified") } catch (e: Exception) { capture(11, e) }
    try { throw SecurityException("Denied auth") } catch (e: Exception) { capture(12, e) }
    try { "A".substring(5) } catch (e: Exception) { capture(13, e) }
    try { throw RuntimeException("Generic runtime") } catch (e: Exception) { capture(14, e) }
    try { throw IOException("IO error simulated") } catch (e: Exception) { capture(15, e) }
    try { throw IOException("Socket timeout") } catch (e: Exception) { capture(16, e) }
    try { throw IllegalAccessException("Cannot access property") } catch (e: Exception) { capture(17, e) }
    try { throw ParseException("Unparsable date", 0) } catch (e: Exception) { capture(18, e) }
    try { throw ArrayStoreException("Array type mismatch") } catch (e: Exception) { capture(19, e) }
    try { throw Exception("Generic custom exception") } catch (e: Exception) { capture(20, e) }

    println("\nSignaling Shutdown and awaiting flush...")
    sdk.shutdown()
    println("✅ Done")
}
